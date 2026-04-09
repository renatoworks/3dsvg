'use client';
import React, { useState, useEffect } from 'react';
import { Check, MessageCircleMore } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// -----------------------------
// Types and Interfaces
// -----------------------------

type Sentiment = '😍' | '😊' | '😐' | '☹️' | '😡';
type Step = 1 | 2 | 'success';

interface Metadata {
  browser: {
    userAgent: string;
    language: string;
    platform: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  context: {
    url: string;
    timestamp: string;
    referrer: string;
    location?: {
      city: string;
      country: string;
      timezone: string;
      continent: string;
    };
  };
}

interface FeedbackWidgetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideButton?: boolean;
}

type FreedbackProps = FeedbackWidgetProps & {
  title?: string;
  buttonTitle?: string;
  placeholder?: string;
  showEmojis?: boolean;
  collectEmail?: boolean;
  emailRequired?: boolean;
  storage?: 'supabase' | 'email' | 'console';
  mode?: 'button' | 'inline';
};

// -----------------------------
// Utility: Collect browser and context metadata
// -----------------------------
const collectMetadata = async (): Promise<Metadata> => {
  let location;
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    location = {
      city: data.city,
      country: data.country_name,
      timezone: data.timezone,
      continent: data.continent_code,
    };
  } catch (error) {
    console.error('Error fetching location:', error);
  }

  return {
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
    context: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      location,
    },
  };
};

// -----------------------------
// Utility: Log feedback to console (fallback)
// -----------------------------
const logFeedback = (data: {
  sentiment: Sentiment;
  message: string;
  email?: string;
  metadata: Metadata;
}) => {
  console.group('📝 New Feedback Submitted');
  console.log('Sentiment:', data.sentiment);
  console.log('Message:', data.message);
  if (data.email) console.log('Email:', data.email);
  console.group('🌍 Context');
  console.log('URL:', data.metadata.context.url);
  console.log('Timestamp:', data.metadata.context.timestamp);
  if (data.metadata.context.location) {
    console.log('Location:', `${data.metadata.context.location.city}, ${data.metadata.context.location.country}`);
  }
  console.log('Browser:', data.metadata.browser.platform);
  console.log('Language:', data.metadata.browser.language);
  console.log('Viewport:', `${data.metadata.browser.viewport.width}x${data.metadata.browser.viewport.height}`);
  console.groupEnd();
  console.groupEnd();
};

// -----------------------------
// Main Feedback Widget Component
// -----------------------------
export function Freedback({
  open,
  onOpenChange,
  hideButton = false,
  title = "What's your feedback?",
  buttonTitle = 'Feedback',
  placeholder = 'Ideas to improve the product...',
  showEmojis = true,
  collectEmail = true,
  emailRequired = false,
  storage = 'supabase',
  mode = 'button',
}: FreedbackProps = {}) {
  // -----------------------------
  // State management
  // -----------------------------
  const [isOpen, setIsOpen] = useState(false);

  // Sync external open prop to internal state
  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);
  const [step, setStep] = useState<Step>(1);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync external open state
  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  // -----------------------------
  // Handle feedback submission
  // -----------------------------
  const handleSubmit = async () => {
    const effectiveStorage = storage;
    if (showEmojis && !sentiment) return;
    if (!message.trim()) return;
    if (collectEmail && emailRequired && !email.trim()) return;
    setIsSubmitting(true);
    try {
      const metadata = await collectMetadata();
      const feedbackData = {
        content: message,
        email: email || undefined,
        emoji: sentiment,
        metadata,
      };
      
      if (effectiveStorage === 'supabase' || effectiveStorage === 'email') {
        // Call our API endpoint (handles both Supabase and email-only modes)
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(feedbackData),
        });

        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }
      } else if (effectiveStorage === 'console') {
        // Log feedback to console only if storage is 'console'
        logFeedback({
          sentiment: sentiment as Sentiment,
          message,
          email: email || undefined,
          metadata,
        });
      }
      
      setStep('success');
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------
  // Utility: Can proceed to next step
  // -----------------------------
  const canProceed = sentiment && message.trim().length > 0;

  // -----------------------------
  // Render UI
  // -----------------------------
  return (
    <>
      {mode === 'button' ? (
        <>
          {!hideButton && (
            <Button
              onClick={() => {
                setStep(1);
                setSentiment(null);
                setMessage('');
                setEmail('');
                setIsOpen(true);
                onOpenChange?.(true);
              }}
              variant="outline"
              className="group inline-flex items-center justify-center cursor-pointer"
              data-aria-hidden="false"
            >
              <MessageCircleMore className="w-4 h-4 transition-all duration-300 origin-bottom-left group-hover:-rotate-12 group-hover:-translate-y-[2px]" />
              <span>{buttonTitle}</span>
            </Button>
          )}

          <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); onOpenChange?.(v); }}>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogContent className="sm:max-w-[425px] p-5 pb-1 bg-card/70 backdrop-blur-xl border-white/[0.06] shadow-[0_8px_32px_oklch(0_0_0/0.4)]">
              {step !== 'success' ? (
                <>
                  <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                    <h2 className="text-lg font-semibold leading-none tracking-tight">
                      {step === 1 && title}
                    </h2>
                    <p className="sr-only">
                      Share your feedback about this product
                    </p>
                  </div>
                  <div className="py-4">
                    {step === 1 && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Textarea
                            id="message"
                            placeholder={placeholder}
                            value={message}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            {(['😍', '😊', '😐', '☹️', '😡'] as const).map(
                              emoji => (
                                <Button
                                  key={emoji}
                                  onClick={() => setSentiment(emoji)}
                                  className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                                    sentiment === emoji
                                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                      : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                                  } h-8 w-8 p-0`}
                                >
                                  {emoji}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setStep(2)}
                            disabled={!canProceed}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                    {step === 2 && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="email"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                          >
                            If you want to hear back from us, leave your email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setStep(1)}
                            variant="outline"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                          >
                            {isSubmitting ? 'Sending...' : 'Send Feedback'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                    <p className="sr-only">
                      Feedback submission confirmation
                    </p>
                  </div>
                  <div className="py-10 pb-14 flex flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Check className="w-6 h-6 text-primary animate-in zoom-in duration-300" />
                    </div>
                    <h3 className="font-medium mb-1">Thanks for your feedback!</h3>
                    <p className="text-sm text-muted-foreground">
                      {email ? "We'll get back to you soon." : ''}
                    </p>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        // Inline mode
        <div className="w-full flex flex-col items-center">
          <div className="flex flex-col items-center space-y-2 px-6 py-4">
            
            {step !== 'success' && (
              <>
                <span className="text-base font-medium text-muted-foreground mb-1">{title}</span>
                <div className="flex items-center gap-2">
                  {(['😍', '😊', '😐', '☹️', '😡'] as const).map(emoji => (
                    <Button
                      key={emoji}
                      onClick={() => setSentiment(emoji)}
                      className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                        sentiment === emoji
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-transparent hover:bg-accent hover:text-accent-foreground'
                      } h-8 w-8 p-0`}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
          {// Show input and submit after emoji selection, or thank you after submit}
          step !== 'success' && sentiment && (
            <div className="w-full max-w-md mt-4 flex flex-col items-center gap-4">
              <div className="w-full max-w-md flex flex-col gap-2">
                <Textarea
                  id="message"
                  placeholder={placeholder}
                  value={message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
                {collectEmail && (
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}
              </div>
              <div className="flex gap-2 w-full justify-end ">
                <Button
                  onClick={() => {
                    setSentiment(null);
                    setMessage('');
                    setEmail('');
                    setStep(1);
                  }}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !message.trim() || (collectEmail && emailRequired && !email.trim())}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
                </Button>
              </div>
            </div>
          )}
          {step === 'success' && (
            <div className="w-full max-w-md mt-4 flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Check className="w-6 h-6 text-primary animate-in zoom-in duration-300" />
              </div>
              <h3 className="font-medium mb-1">Thanks for your feedback!</h3>
              <p className="text-sm text-muted-foreground">
                {email ? "We'll get back to you soon." : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export type { Sentiment }; 