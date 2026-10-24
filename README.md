# Agentic Personal Assistant

Importez vos PDF, puis posez-leur des questions. Les réponses sont générées par un modèle local (Ollama) à partir des passages les plus pertinents, avec la source et la page citées.

## Ce que ça fait

- Import de PDF et indexation dans Pinecone
- Chat sur vos documents, avec les sources
- Historique des conversations enregistré dans MongoDB
- Interface web en React

## Ce qu'il faut avoir

- Node.js 20 ou plus
- MongoDB (en local ou Atlas)
- [Ollama](https://ollama.com) avec un modèle : `ollama pull qwen2.5:3b`
- Un compte Pinecone avec un index à embeddings intégrés

## Lancer le projet

```bash
git clone <url-du-depot>
cd agentic-rag
npm run install:all
cp server/.env.example server/.env   # puis remplissez vos valeurs
npm run dev
```

- Interface : http://localhost:5173
- API : http://localhost:3001

## Configuration (`server/.env`)

| Variable | Rôle | Défaut |
|---|---|---|
| `PINECONE_API_KEY` | Clé Pinecone (obligatoire) | – |
| `PINECONE_INDEX` | Nom de l'index (obligatoire) | – |
| `MONGODB_URI` | Connexion MongoDB | `mongodb://127.0.0.1:27017` |
| `OLLAMA_MODEL` | Modèle utilisé | `qwen2.5:3b` |
| `OLLAMA_URL` | Adresse d'Ollama | `http://localhost:11434` |

## Comment ça marche

1. Le PDF est découpé en morceaux de 1000 caractères et envoyé à Pinecone.
2. À chaque question, on cherche les 6 morceaux les plus proches.
3. Ces morceaux sont donnés à Ollama avec la question, et il répond uniquement à partir d'eux.

## Structure

```
server/   API Express, logique RAG, Pinecone, MongoDB
client/   Interface React (Vite)
```