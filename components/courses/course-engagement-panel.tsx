"use client";

import { Heart, MessageSquareText, Send, Star } from "lucide-react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type CourseEngagementPanelProps = {
  courseId: string;
  initialLiked: boolean;
  initialLikes: number;
  initialReview?: {
    rating: number;
    body: string | null;
  } | null;
};

export function CourseEngagementPanel({
  courseId,
  initialLiked,
  initialLikes,
  initialReview,
}: CourseEngagementPanelProps) {
  const router = useRouter();
  const { messages } = useUiSettings();
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [rating, setRating] = useState(initialReview?.rating ?? 5);
  const [reviewBody, setReviewBody] = useState(initialReview?.body ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [pendingComment, setPendingComment] = useState(false);

  async function toggleLike() {
    setPendingLike(true);
    setFeedback(null);

    const response = await fetch(`/api/courses/${courseId}/like`, {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as
      | { liked?: boolean; totalLikes?: number; error?: string }
      | null;

    if (!response.ok) {
      setFeedback(payload?.error ?? messages.course.likeError);
      setPendingLike(false);
      return;
    }

    setLiked(Boolean(payload?.liked));
    setLikes(payload?.totalLikes ?? likes);
    startTransition(() => {
      router.refresh();
    });
    setPendingLike(false);
  }

  async function submitReview() {
    setPendingReview(true);
    setFeedback(null);

    const response = await fetch(`/api/courses/${courseId}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rating,
        body: reviewBody,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFeedback(payload?.error ?? messages.course.reviewError);
      setPendingReview(false);
      return;
    }

    setFeedback(messages.course.reviewSaved);
    startTransition(() => {
      router.refresh();
    });
    setPendingReview(false);
  }

  async function submitComment() {
    setPendingComment(true);
    setFeedback(null);

    const response = await fetch(`/api/courses/${courseId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: commentBody,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFeedback(payload?.error ?? messages.course.commentError);
      setPendingComment(false);
      return;
    }

    setCommentBody("");
    setFeedback(messages.course.commentPublished);
    startTransition(() => {
      router.refresh();
    });
    setPendingComment(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{messages.course.reactTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#112437]">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {messages.course.interestSignal}
            </p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-heading text-3xl dark:text-zinc-100">{likes}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {messages.course.accumulatedLikes}
                </p>
              </div>
              <Button
                type="button"
                variant={liked ? "default" : "outline"}
                disabled={pendingLike}
                onClick={toggleLike}
              >
                <Heart className="h-4 w-4" />
                {liked ? messages.course.liked : messages.course.like}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#112437]">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {messages.course.yourReading}
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }, (_, index) => {
                const score = index + 1;
                return (
                  <button
                    key={score}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                      rating >= score
                        ? "border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-300/50 dark:bg-amber-500/15 dark:text-amber-200"
                        : "border-zinc-200 bg-white text-zinc-400 dark:border-white/12 dark:bg-[#102132] dark:text-zinc-500"
                    }`}
                    type="button"
                    onClick={() => setRating(score)}
                  >
                    <Star className={`h-4 w-4 ${rating >= score ? "fill-current" : ""}`} />
                  </button>
                );
              })}
            </div>
            <Textarea
              className="mt-4 min-h-24"
              placeholder={messages.course.reviewPlaceholder}
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
            />
            <Button className="mt-4 w-full" type="button" disabled={pendingReview} onClick={submitReview}>
              <Send className="h-4 w-4" />
              {messages.course.saveReview}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.course.publicComment}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600 dark:bg-[#112437] dark:text-zinc-300">
            {messages.course.publicCommentDescription}
          </div>
          <Textarea
            placeholder={messages.course.commentPlaceholder}
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <Button className="w-full" type="button" disabled={pendingComment} onClick={submitComment}>
            <MessageSquareText className="h-4 w-4" />
            {messages.course.publishComment}
          </Button>
          {feedback ? <p className="text-sm text-teal-700 dark:text-teal-200">{feedback}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
