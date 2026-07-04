'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Send, Loader2, Users, Save } from 'lucide-react';
import {
  SMART_AUDIENCES,
  isSmartAudience,
  resolveSmartAudienceIds,
  smartWindowDays,
  type AudienceConfig,
} from '@/lib/broadcasts/audience';

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  /** `scheduledAt` is an ISO string when the user picks "Schedule for
   *  later", otherwise null for immediate send. */
  onSend: (scheduledAt: string | null) => void;
  onSaveDraft?: () => void;
  onBack: () => void;
  isProcessing: boolean;
  progress: number;
}

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  onSend,
  onSaveDraft,
  onBack,
  isProcessing,
  progress,
}: Step4Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);
  const [mode, setMode] = useState<'now' | 'later'>('now');
  // `datetime-local` value (local time, no timezone suffix).
  const [scheduleAt, setScheduleAt] = useState('');

  // Resolve the chosen schedule to an ISO string, or null for "send now"
  // / an incomplete selection.
  const scheduledIso =
    mode === 'later' && scheduleAt ? new Date(scheduleAt).toISOString() : null;
  const scheduleInPast =
    mode === 'later' && scheduleAt
      ? new Date(scheduleAt).getTime() <= Date.now()
      : false;
  const canSubmit = !!name.trim() && !isProcessing && !scheduleInPast &&
    !(mode === 'later' && !scheduleAt);

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set((contactTags ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else if (isSmartAudience(audience.type)) {
          const ids = await resolveSmartAudienceIds(
            supabase,
            audience.type,
            smartWindowDays(audience),
          );
          setEstimatedReach(ids.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  const smartLabel = isSmartAudience(audience.type)
    ? SMART_AUDIENCES.find((a) => a.type === audience.type)?.label
    : undefined;
  const audienceLabel =
    audience.type === 'all'
      ? 'All Contacts'
      : audience.type === 'tags'
        ? `Tags (${audience.tagIds?.length ?? 0} selected)`
        : audience.type === 'csv'
          ? 'CSV Upload'
          : (smartLabel ?? 'Custom');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review & Send</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name your broadcast, review the details, and send.
        </p>
      </div>

      {/* Broadcast Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Broadcast Name</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Summer Sale Announcement"
          className="border-border bg-secondary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Summary</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Template</p>
            <p className="text-foreground">{template.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Audience</p>
            <p className="text-foreground">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated Reach</p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-foreground">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">When to send</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'now' ? 'default' : 'outline'}
            onClick={() => setMode('now')}
            disabled={isProcessing}
            className={
              mode === 'now'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border text-foreground'
            }
          >
            Send now
          </Button>
          <Button
            type="button"
            variant={mode === 'later' ? 'default' : 'outline'}
            onClick={() => setMode('later')}
            disabled={isProcessing}
            className={
              mode === 'later'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border text-foreground'
            }
          >
            Schedule for later
          </Button>
        </div>
        {mode === 'later' && (
          <div className="mt-3">
            <Input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              disabled={isProcessing}
              className="border-border bg-secondary text-foreground"
            />
            {scheduleInPast && (
              <p className="mt-1.5 text-xs text-red-400">
                Pick a time in the future.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Sending broadcast...</p>
            </div>
            <span className="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="border-border text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-border text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogTrigger
            render={
              <Button
                disabled={!canSubmit}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              />
            }
          >
            <Send className="h-4 w-4" />
            {scheduledIso ? 'Schedule Broadcast' : 'Send Broadcast'}
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {scheduledIso ? 'Confirm Schedule' : 'Confirm Broadcast'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {scheduledIso ? (
                  <>
                    This broadcast will be sent to{' '}
                    <span className="font-medium text-foreground">
                      {estimatedReach.toLocaleString()}
                    </span>{' '}
                    contacts using the{' '}
                    <span className="font-medium text-foreground">{template.name}</span>{' '}
                    template on{' '}
                    <span className="font-medium text-foreground">
                      {new Date(scheduledIso).toLocaleString()}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    You are about to send this broadcast to{' '}
                    <span className="font-medium text-foreground">
                      {estimatedReach.toLocaleString()}
                    </span>{' '}
                    contacts using the{' '}
                    <span className="font-medium text-foreground">{template.name}</span>{' '}
                    template. This action cannot be undone.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="border-border text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowConfirm(false);
                  onSend(scheduledIso);
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                {scheduledIso ? 'Confirm & Schedule' : 'Confirm & Send'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
