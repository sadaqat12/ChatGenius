import { messageEmbeddingWorker } from './services/message-embedding-service';

// Start the worker if we're on the server side
if (typeof window === 'undefined') {
  messageEmbeddingWorker.start().catch(error => {
    console.error('Failed to start message embedding worker:', error);
  });
} 