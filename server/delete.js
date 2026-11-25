
import "dotenv/config";

const API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX;

if (!API_KEY || !INDEX_NAME) {
    throw new Error("Configuration Pinecone manquante dans .env");
}

async function deleteAllDocuments() {
    try {
        console.log("Index :", INDEX_NAME);

        // Récupérer les informations de l'index
        const describeResponse = await fetch(
            `https://api.pinecone.io/indexes/${INDEX_NAME}`,
            {
                headers: {
                    "Api-Key": API_KEY,
                    "X-Pinecone-API-Version": "2026-07"
                }
            }
        );

        if (!describeResponse.ok) {
            throw new Error(await describeResponse.text());
        }

        const indexInfo = await describeResponse.json();
        const host = indexInfo.host;

        console.log("Host :", host);
        console.log("Suppression des documents...");

        // Supprimer tous les documents du namespace par défaut
        const response = await fetch(
            `https://${host}/namespaces/__default__/documents/delete`,
            {
                method: "POST",
                headers: {
                    "Api-Key": API_KEY,
                    "Content-Type": "application/json",
                    "X-Pinecone-API-Version": "2026-07"
                },
                body: JSON.stringify({
                    delete_all: true
                })
            }
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

        console.log("✅ Suppression demandée avec succès !");

    } catch (error) {
        console.error("❌ Erreur :", error.message);
    }
}

deleteAllDocuments();
