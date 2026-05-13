"""
CNN-LSTM hybrid for blockchain payment-fraud detection.

Reference: Yuan, Lin, Wu, Chang. "Detection of Blockchain Online Payment Fraud
Via CNN-LSTM." BDICN 2026. ACM Digital Library, DOI 10.1145/3801228.3801323.

Architecture per Tables 1 and 2 of the paper.

Faithfulness notes
------------------
- CNN block: 3 x Conv1D + 2 x MaxPool1D, filter counts 32 / 64 / 64,
  kernel sizes 3 / 5 / 3, ReLU activations, "same" padding. Matches Table 1.
- LSTM block: 2 x bidirectional LSTM, hidden 128 then 64 (each direction),
  recurrent_dropout=0.2, dropout=0.3 between layers. Dense(32, ReLU) head and
  Sigmoid output. Matches Table 2.
- The paper's Table 1 shows a GlobalAveragePooling1D as the last CNN op,
  which would collapse the sequence dimension before the LSTM. The paper's
  prose ("All these feature vectors are then reconstructed into chronological
  order while maintaining the 49-step time-dynamic profile") makes clear that
  the sequence dimension is preserved when entering the LSTM. We follow the
  prose: the CNN output retains its (reduced) time axis and is fed directly
  to the BiLSTM. Set `use_global_pool=True` to use the literal Table-1 layout
  followed by a sequence-unsqueeze; the default `False` follows the prose.
- Orthogonal initialization is applied to LSTM recurrent kernels per the paper.
- Weighted binary cross-entropy is supplied via `pos_weight` in `nn.BCEWithLogitsLoss`
  by the trainer; the model itself emits logits.
"""

from __future__ import annotations

import torch
import torch.nn as nn


def _orthogonal_init_lstm(lstm: nn.LSTM) -> None:
    for name, param in lstm.named_parameters():
        if "weight_hh" in name:
            nn.init.orthogonal_(param)
        elif "weight_ih" in name:
            nn.init.xavier_uniform_(param)
        elif "bias" in name:
            nn.init.zeros_(param)


class CNNBlock(nn.Module):
    def __init__(self, in_features: int, use_global_pool: bool = False) -> None:
        super().__init__()
        self.use_global_pool = use_global_pool
        # PyTorch Conv1d expects (N, C, L); we'll transpose at forward time.
        self.conv1 = nn.Conv1d(in_features, 32, kernel_size=3, padding=1)
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.conv2 = nn.Conv1d(32, 64, kernel_size=5, padding=2)
        self.pool2 = nn.MaxPool1d(kernel_size=2)
        self.conv3 = nn.Conv1d(64, 64, kernel_size=3, padding=1)
        self.act = nn.ReLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, time, features)
        x = x.transpose(1, 2)  # (batch, features, time)
        x = self.act(self.conv1(x))
        x = self.pool1(x)
        x = self.act(self.conv2(x))
        x = self.pool2(x)
        x = self.act(self.conv3(x))
        if self.use_global_pool:
            x = x.mean(dim=-1, keepdim=True)  # (batch, 64, 1)
        x = x.transpose(1, 2)  # (batch, time_reduced, 64)
        return x


class CNNLSTM(nn.Module):
    def __init__(
        self,
        in_features: int = 166,
        lstm_hidden_1: int = 128,
        lstm_hidden_2: int = 64,
        dense_units: int = 32,
        dropout_between: float = 0.3,
        recurrent_dropout_target: float = 0.2,  # informational; see notes
        use_global_pool: bool = False,
    ) -> None:
        super().__init__()
        self.cnn = CNNBlock(in_features=in_features, use_global_pool=use_global_pool)

        self.lstm1 = nn.LSTM(
            input_size=64,
            hidden_size=lstm_hidden_1,
            bidirectional=True,
            batch_first=True,
        )
        self.dropout = nn.Dropout(dropout_between)
        self.lstm2 = nn.LSTM(
            input_size=lstm_hidden_1 * 2,
            hidden_size=lstm_hidden_2,
            bidirectional=True,
            batch_first=True,
        )
        self.dense = nn.Linear(lstm_hidden_2 * 2, dense_units)
        self.act = nn.ReLU()
        self.out = nn.Linear(dense_units, 1)
        # PyTorch's nn.LSTM does not support per-step recurrent dropout in the
        # Keras sense. We document the target value but do not silently use a
        # different mechanism.
        self.recurrent_dropout_target = recurrent_dropout_target

        _orthogonal_init_lstm(self.lstm1)
        _orthogonal_init_lstm(self.lstm2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, time, features)
        feats = self.cnn(x)                # (batch, time', 64)
        seq1, _ = self.lstm1(feats)        # (batch, time', 256)
        seq1 = self.dropout(seq1)
        seq2, _ = self.lstm2(seq1)         # (batch, time', 128)
        last = seq2[:, -1, :]              # take final time step (return_sequences=False)
        h = self.act(self.dense(last))     # (batch, 32)
        logits = self.out(h).squeeze(-1)   # (batch,)
        return logits
