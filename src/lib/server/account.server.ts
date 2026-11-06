import type { OrderRecord } from "../orders";
import type { ReviewRecord } from "../reviews";
import { REVIEW_COLUMNS, toReviewRecords } from "./admin.server";
import { dbFailure, requireServiceDb } from "./db.server";
import { listViewerOrders } from "./orders.server";
import { requireViewer, type Viewer } from "./viewer.server";

export interface AccountData {
  orders: OrderRecord[];
  reviews: ReviewRecord[];
}

export async function getAccount(viewer: Viewer | null): Promise<AccountData> {
  const me = requireViewer(viewer);
  const db = requireServiceDb();
  const [orders, reviews] = await Promise.all([
    listViewerOrders(me),
    db
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (reviews.error) throw dbFailure(reviews.error, "load your reviews");
  return { orders, reviews: await toReviewRecords(reviews.data ?? []) };
}
