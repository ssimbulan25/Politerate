# Politerate

**Breaking news from all sides. Delivering only the crucial information while trying to separate the facts from emotion. **

## Overview

Politerate addresses the challenge of staying informed about political news in an era of declining media trust, misinformation, and information fatigue. Our platform combines multiple sources across the political spectrum, summarizes key stories into digestible briefings, and explains political jargon with full source transparency.

## The Problem

- **Declining trust in media** - People are increasingly skeptical of news stations and unsure which sources to trust
- **Misinformation** - Facts and truth are often misrepresented to persuade readers toward particular viewpoints
- **Information fatigue** - News is boring and hard to keep up with. People don't like long reads or deciding which source to read

## Our Approach

Politerate combines sources from many different viewpoints of the political spectrum and summarizes them into a few short bullet points based on the most relevant information present across all articles. We make information digestible and easy to interpret, simplifying the political landscape so relevant information doesn't get lost within all the nuances of the spectrum.

## Features

### Daily Brief View
The most reported on topics win a spot on the daily brief. The more outlets that report on a specific topics, the bigger they will appear on the brief. 

### Topic Clusters View
Dive deeper into specific topics with individual summaries. Each cluster groups related articles together, showing multiple perspectives on the same story.

### Political Glossary
Learn political jargon with clear, accessible definitions. Each term includes links to the articles where it was used, providing full transparency about where our definitions are applied.

### Source Credibility
Understand source reliability at a glance. Each source is evaluated based on subjectivity, propaganda technique, political bias, and intended emotion.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Scrape    │ ──▶ │  Preprocess  │ ──▶│   Cluster   │
│   Articles  │     │     Text     │     │    Topics   │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Highlight │ ◀──│   Summarize  │ ◀── │   Filter    │
│    Terms    │     │    (BART)    │     │   Analyzer  │
└─────────────┘     └──────────────┘     └─────────────┘ 
```

1. **Scrape** - Articles are collected from trusted RSS feeds
2. **Preprocess** - Text is cleaned and normalized
3. **Filter** - Credibility analysis flags low-quality sources
4. **Analyzer** - Multi-head DeBERTA model analyzes each article for literary persuasion techniques, subjectivity, and bias
5. **Cluster** - Articles are grouped by topic using semantic embeddings
6. **Summarize** - Fine-tuned BART transformer generates natural summaries
7. **Highlight** - Political terms are detected and explained with tooltip definitions

## Technical Stack

- **Summarization**: Fine-tuned BART-large transformer model
- **Clustering**: Sentence Transformers (all-MiniLM-L6-v2) + Agglomerative Clustering
- **Credibility Analysis**: DeBERTa-v3 
- **Backend**: Flask + SQLite
- **Frontend**: TypeScript + React


## Team

| Member | Responsibilities |
|--------|-----------------|
| **Sameer** | Transformer summarizer model, pipeline architecture, topics clustering, RSS scraping |
| **Sarah** |  DeBERTa-v3 model for credibility scoring and sentiment analysis, UI/UX, ongoing model training  |


## License

MIT License - See LICENSE file for details

---

*Making political news accessible, one summary at a time.*
