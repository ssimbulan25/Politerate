# backend/inference/predictor.py

import torch
from transformers import AutoTokenizer

from .analyzer import MultiHeadDeBERTa
from .chunker import ArticleChunker
from .labels import (
    TECHNIQUE_LABELS, EMOTION_LABELS, BIAS_LABELS, BIAS_DISPLAY_NAMES,
    TECHNIQUE_THRESHOLDS, NUM_TECHNIQUE, NUM_EMOTION, NUM_BIAS, NUM_SUBJ,
    BACKBONE_MODEL, MAX_SEQ_LEN,
)


class PoliterateAnalyzer:
    def __init__(self, weights_path: str, device: str = "cpu"):
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(BACKBONE_MODEL)
        self.chunker = ArticleChunker()
        
        # Load model
        self.model = MultiHeadDeBERTa(
            backbone_name=BACKBONE_MODEL,
            num_technique=NUM_TECHNIQUE,
            num_emotion=NUM_EMOTION,
            num_subj=NUM_SUBJ,
            num_bias=NUM_BIAS,
        )
        
        checkpoint = torch.load(weights_path, map_location=device)
        if 'model_state_dict' in checkpoint:
            missing, unexpected = self.model.load_state_dict(
            checkpoint['model_state_dict'], 
            strict=False
        )
        else:
            missing, unexpected = self.model.load_state_dict(
            checkpoint, 
            strict=False
        )
        if unexpected:
            print(f"Ignored unexpected keys (expected — loss fn artifacts): {unexpected}")
        if missing:
            print(f"WARNING: Missing keys in checkpoint: {missing}")
        self.model.to(device).float().eval()
    
    def predict_chunk(self, text: str) -> dict:
        """Predict labels for a single chunk."""
        inputs = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQ_LEN,
            return_tensors="pt",
        ).to(self.device)
        
        with torch.no_grad():
            result = self.model(
                input_ids=inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                token_type_ids=inputs.get("token_type_ids"),
            )
        
        # Technique: multi-label with per-class thresholds
        tech_probs = torch.sigmoid(result["technique_logits"])[0].cpu().numpy()
        techniques = [
            {
                "label": TECHNIQUE_LABELS[i],
                "confidence": float(tech_probs[i]),
            }
            for i in range(NUM_TECHNIQUE)
            if tech_probs[i] > TECHNIQUE_THRESHOLDS[TECHNIQUE_LABELS[i]]
        ]
        
        # Emotion, subjectivity and bias: single-class argmax, with the
        # chosen class's softmax probability as its confidence (shown in
        # the article page's per-sentence breakdown).
        emotion_probs = torch.softmax(result["emotion_logits"], dim=-1)[0]
        emotion_idx = int(torch.argmax(emotion_probs).item())

        subj_probs = torch.softmax(result["subjectivity_logits"], dim=-1)[0]
        subj_idx = int(torch.argmax(subj_probs).item())

        bias_probs = torch.softmax(result["bias_logits"], dim=-1)[0]
        bias_idx = int(torch.argmax(bias_probs).item())
        bias_label = BIAS_LABELS[bias_idx]

        return {
            "text": text,
            "techniques": techniques,
            "emotion": EMOTION_LABELS[emotion_idx],
            "emotion_confidence": float(emotion_probs[emotion_idx]),
            "subjective": subj_idx == 1,
            # Confidence in whichever was chosen, subjective or objective.
            "subjectivity_confidence": float(subj_probs[subj_idx]),
            "bias": BIAS_DISPLAY_NAMES[bias_label],  # human-readable
            "bias_confidence": float(bias_probs[bias_idx]),
        }
    
    def predict_article(self, text: str) -> dict:
        """Predict labels for an entire article."""
        chunks = self.chunker.chunk_article(text)
        chunk_predictions = [self.predict_chunk(c) for c in chunks]
        
        # Aggregate article-level summary
        from collections import Counter
        
        all_techniques = [
            t["label"] for c in chunk_predictions for t in c["techniques"]
        ]
        all_emotions = [c["emotion"] for c in chunk_predictions]
        subj_count = sum(1 for c in chunk_predictions if c["subjective"])
        all_biases = [c["bias"] for c in chunk_predictions]
        
        return {
            "chunks": chunk_predictions,
            "article": {
                "dominant_bias": Counter(all_biases).most_common(1)[0][0] if all_biases else None,
                "dominant_emotion": Counter(all_emotions).most_common(1)[0][0] if all_emotions else None,
                "subjectivity_ratio": subj_count / len(chunk_predictions) if chunk_predictions else 0,
                "technique_counts": dict(Counter(all_techniques)),
            },
        }