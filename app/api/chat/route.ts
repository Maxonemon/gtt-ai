import { Mistral } from '@mistralai/mistralai';

// Define Messages type for incoming messages
type Messages = {
  role: string;
  content: string;
};
import { NextResponse } from 'next/server';
const apiKey = process.env.MISTRAL_API_KEY
const client = new Mistral({ apiKey });

// Grant Thornton context information
const GRANT_THORNTON_CONTEXT = `
Vous êtes un assistant IA pour Grant Thornton, un cabinet mondial leader en audit, fiscalité et conseil. 
Grant Thornton fournit des services incluant :

- Audit et Assurance : Audits d'états financiers, audit interne, gestion des risques
- Services Fiscaux : Fiscalité des entreprises, fiscalité internationale, fiscalité indirecte, planification fiscale personnelle
- Services Conseil : Conseil en affaires, conseil en transactions, restructuration, comptabilité judiciaire
- Solutions Technologiques : Implémentation ERP, cybersécurité, analyse de données
- Expertise Sectorielle : Santé, services financiers, industrie manufacturière, immobilier, technologie

Informations clés sur Grant Thornton :
- Fondé en 1924 à Chicago
- Réseau mondial avec des cabinets membres dans plus de 130 pays
- Sert les entreprises publiques et privées
- Focus sur les entreprises du marché intermédiaire
- Reconnu pour son service personnalisé et son expertise sectorielle
- Engagement à aider les entreprises à libérer leur potentiel de croissance

Lors de vos réponses :
1. Soyez professionnel et informé sur les services de Grant Thornton
2. Fournissez des informations utiles et précises sur les affaires et les finances
3. Si vous analysez des documents, concentrez-vous sur les insights financiers, fiscaux ou d'affaires
4. Maintenez toujours la confidentialité et les standards professionnels
5. Suggérez les services Grant Thornton pertinents quand approprié
6. Répondez toujours en français de manière professionnelle et courtoise
`;

export async function POST(request:Request) {
  try {
    const { messages, fileContent } = await request.json();

    // Prepare the conversation for Mistral
    let conversationMessages = [
      {
        role: 'system',
        content: GRANT_THORNTON_CONTEXT
      }
    ];

    if (fileContent && typeof fileContent === 'string' && fileContent.trim()) {
      conversationMessages.push({
        role: 'system',
        content: `L'utilisateur a téléchargé un document PDF. Voici le texte extrait pour analyse :\n\n${fileContent}\n\nVeuillez analyser ce texte et fournir des insights liés aux domaines d'expertise de Grant Thornton (audit, fiscalité, conseil, etc.).`
      });
    }

    const userMessages = messages.filter((msg:Messages) => msg.role !== 'system');
    conversationMessages = [...conversationMessages, ...userMessages];

    // Streaming response using Mistral SDK (adapted from your example)
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await client.chat.stream({
            model: 'mistral-small-latest', // Use the latest small model
            messages: conversationMessages as any,
            temperature: 0.7,
            maxTokens: 1000,
          });
          for await (const chunk of result) {
            // Use the same structure as your example
            const streamText = chunk.data?.choices?.[0]?.delta?.content;
            if (typeof streamText === 'string') {
              const sseData = `data: ${JSON.stringify({ content: streamText })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseData));
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = getErrorMessage(error);
          const sseData = `data: ${JSON.stringify({ content: errorMessage })}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Mistral API Error:', error);
    const errorMessage = getErrorMessage(error);
    const stream = new ReadableStream({
      start(controller) {
        const sseData = `data: ${JSON.stringify({ content: errorMessage })}\n\n`;
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      }
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}

// Helper function to get appropriate error message
function getErrorMessage(error: any): string {
  if (error.message?.includes('API key')) {
    return 'Erreur de configuration de la clé API. Veuillez vérifier votre clé API Mistral.';
  }
  
  if (error.message?.includes('rate limit')) {
    return 'Limite de taux dépassée. Veuillez réessayer dans un moment.';
  }

  return 'Je m\'excuse, mais j\'ai rencontré une erreur lors du traitement de votre demande. Veuillez réessayer.';
}

// Handle preflight requests for CORS
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}