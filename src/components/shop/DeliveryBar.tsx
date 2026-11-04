import { Clock, Flower2, HeartHandshake, Leaf } from "lucide-react";
import { useSiteContent } from "@/hooks/use-site-content";

export function DeliveryBar() {
  const { getText } = useSiteContent();

  const promises = [
    {
      icon: Clock,
      title: getText("delivery_promise_1_title", "Same-day delivery"),
      body: getText("delivery_promise_1_body", "Order by 2pm, at their door tonight"),
    },
    {
      icon: Leaf,
      title: getText("delivery_promise_2_title", "7-day freshness guarantee"),
      body: getText("delivery_promise_2_body", "Wilted early? We'll replace it free"),
    },
    {
      icon: Flower2,
      title: getText("delivery_promise_3_title", "Hand-tied by local florists"),
      body: getText("delivery_promise_3_body", "Never boxed in a warehouse"),
    },
    {
      icon: HeartHandshake,
      title: getText("delivery_promise_4_title", "Free handwritten card"),
      body: getText("delivery_promise_4_body", "Your words, in real ink"),
    },
  ];

  return (
    <section
      data-trail-section
      aria-label="Our delivery promise"
      className="relative z-10 px-4 sm:px-8"
    >
      <div className="bg-fern-panel mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-6 rounded-3xl px-6 py-7 text-fern-foreground shadow-card sm:px-10 lg:grid-cols-4">
        {promises.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-fern">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">{title}</p>
              <p className="mt-0.5 text-[0.8rem] leading-snug text-fern-foreground/75">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
