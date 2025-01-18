import { useRAG } from '@/hooks/useRAG';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ContextMessage {
  id: string;
  content: string;
  similarity: number;
}

export function AIChatArea() {
  const params = useParams();
  const teamId = params.teamId as string;

  const {
    messages,
    context,
    isLoading,
    error,
    askQuestion,
    clearConversation,
    lastAction
  } = useRAG({
    teamId,
    similarityThreshold: 0.7
  });

  const [openContexts, setOpenContexts] = useState<{[key: number]: boolean}>({});

  const toggleContext = (index: number) => {
    setOpenContexts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  useEffect(() => {
    if (lastAction?.type === 'send_message') {
      toast.success(`Message sent to ${lastAction.payload.recipient}`, {
        description: lastAction.payload.message
      });
    }
  }, [lastAction]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.message.value;
    
    if (!input.trim() || isLoading) return;
    form.reset();

    await askQuestion(input.trim());
  };

  const handleClearConversation = async () => {
    try {
      await clearConversation();
      toast.success('Conversation history cleared');
    } catch (err) {
      console.error('Error clearing conversation:', err);
      toast.error('Failed to clear conversation history');
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-none">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/kia-avatar.svg" alt="KIA" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
              KIA
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">KIA</h2>
            <p className="text-xs text-muted-foreground">Know It All Bot</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearConversation}
          disabled={isLoading || messages.length === 0}
          title="Clear conversation history"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src="/kia-avatar.svg" alt="KIA" />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                    KIA
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col gap-2">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && context && context.messages.length > 0 && (
                  <Collapsible
                    open={openContexts[i]}
                    onOpenChange={() => toggleContext(i)}
                    className="text-xs text-muted-foreground mt-2 border-t pt-2"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full flex justify-between items-center p-2 hover:bg-accent">
                        <span className="font-semibold">Related Messages ({context.messages.length})</span>
                        {openContexts[i] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2">
                        {(context.messages as ContextMessage[]).map((msg) => (
                          <div key={msg.id} className="p-2 rounded bg-background/50">
                            <p className="mb-1">{msg.content}</p>
                            <p className="text-xs opacity-50">
                              Similarity: {(msg.similarity * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
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
        </form>
      </div>
    </div>
  );
} 