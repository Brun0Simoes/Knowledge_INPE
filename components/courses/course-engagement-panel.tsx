"use client";

import { Heart, LockKeyhole, MessageSquareText, Send, Star, UserPlus } from "lucide-react";
import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { withBasePath } from "@/lib/base-path";

type CourseEngagementPanelProps = {
  courseId: string;
  initialLiked: boolean;
  initialLikes: number;
  initialReview?: {
    rating: number;
    body: string | null;
  } | null;
  isAuthenticated: boolean;
};

export function CourseEngagementPanel({
  courseId,
  initialLiked,
  initialLikes,
  initialReview,
  isAuthenticated,
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

    try {
      const response = await fetch(withBasePath(`/api/courses/${courseId}/like`), {
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
    } catch {
      setFeedback(messages.course.likeError);
      setPendingLike(false);
      return;
    }
    setPendingLike(false);
  }

  async function submitReview() {
    setPendingReview(true);
    setFeedback(null);

    try {
      const response = await fetch(withBasePath(`/api/courses/${courseId}/reviews`), {
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
    } catch {
      setFeedback(messages.course.reviewError);
      setPendingReview(false);
      return;
    }
    setPendingReview(false);
  }

  async function submitComment() {
    setPendingComment(true);
    setFeedback(null);

    try {
      const response = await fetch(withBasePath(`/api/courses/${courseId}/comments`), {
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
    } catch {
      setFeedback(messages.course.commentError);
      setPendingComment(false);
      return;
    }
    setPendingComment(false);
  }

  if (!isAuthenticated) {
    return (
      <Card className="lg:col-span-2">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[0.8fr_1.2fr] sm:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {messages.course.memberInteraction}
              </p>
              <h2 className="font-heading text-3xl text-zinc-950 dark:text-zinc-100">
                {messages.course.signInToInteractTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {messages.course.signInToInteractDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login">
                  <LockKeyhole className="h-4 w-4" />
                  {messages.auth.signInButton}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">
                  <UserPlus className="h-4 w-4" />
                  {messages.auth.createAccount}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
