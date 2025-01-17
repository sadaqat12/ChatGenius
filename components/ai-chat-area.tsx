import { useRAG } from '@/hooks/useRAG';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams } from 'next/navigation';

export function AIChatArea() {
  const params = useParams();
  const teamId = params.teamId as string;

  const {
    messages,
    context,
    isLoading,
    error,
    askQuestion,
    clearConversation
  } = useRAG({
    teamId,
    similarityThreshold: 0.7
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.message.value;
    
    if (!input.trim() || isLoading) return;
    form.reset();

    await askQuestion(input.trim());
  };

  return (
    <div className="flex flex-col h-full w-full max-w-none">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Bot className="h-5 w-5" />
        <h2 className="font-semibold">AI Assistant</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 p-4 rounded-lg max-w-[80%]",
                message.role === 'user' 
                  ? "bg-secondary ml-auto" 
                  : "bg-muted mr-auto"
              )}
            >
              {message.role === 'assistant' && (
                <Bot className="h-6 w-6 flex-shrink-0" />
              )}
              <div className="flex flex-col gap-2">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && context && context.messages.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                    <p className="font-semibold mb-1">Related Messages:</p>
                    <div className="space-y-2">
                      {context.messages.map((msg) => (
                        <div key={msg.id} className="p-2 rounded bg-background/50">
                          <p className="mb-1">{msg.content}</p>
                          <p className="text-xs opacity-50">
                            Similarity: {(msg.similarity * 100).toFixed(1)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-5 w-5 animate-spin" />
              <p>Thinking...</p>
            </div>
          )}
          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              Error: {error.message}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <Input
            name="message"
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={clearConversation}
            disabled={isLoading || messages.length === 0}
            title="Clear conversation"
          >
            <Bot className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
} 