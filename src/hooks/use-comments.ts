import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

export interface CommentItem {
  id: string;
  product_id?: string;
  user_id: string;
  comment_text: string;
  rating: number;
  is_approved: boolean;
  created_at: string;
  author_name?: string;
  product_title?: string;
}

export function useComments(productId?: string) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const { user } = useAuth();

  const fetchComments = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from("comments")
        .select(`
          id,
          product_id,
          user_id,
          comment_text,
          rating,
          is_approved,
          created_at,
          profiles ( username )
        `)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Could not load comments:", error.message);
        return;
      }

      if (data) {
        const formatted = data.map((c: any) => ({
          id: c.id,
          product_id: c.product_id,
          user_id: c.user_id,
          comment_text: c.comment_text,
          rating: c.rating ?? 5,
          is_approved: c.is_approved,
          created_at: c.created_at,
          author_name: c.profiles?.username || "Flower Enthusiast",
        }));
        setComments(formatted);
      }
    } catch (err) {
      console.warn("Comments error:", err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (text: string, rating: number = 5, prodId?: string) => {
    if (!user) {
      toast.error("Please log in to leave a review");
      return { error: new Error("Not logged in") };
    }

    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured yet");
      return { error: new Error("Not configured") };
    }

    const targetProdId = prodId || productId;
    if (!targetProdId) {
      toast.error("No bouquet specified for this review");
      return { error: new Error("No bouquet specified") };
    }

    const { error } = await supabase.from("comments").insert({
      product_id: targetProdId,
      user_id: user.id,
      comment_text: text,
      rating,
      is_approved: false, // Requires moderator approval
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success("Thank you! Your review has been submitted for approval.");
    return { error: null };
  };

  return { comments, loading, addComment, refreshComments: fetchComments };
}
