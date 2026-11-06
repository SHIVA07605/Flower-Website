import { Clock, Flower2, HeartHandshake, Leaf } from "lucide-react";
import { useStorefront } from "./storefront";

export function DeliveryBar() {
  const { content } = useStorefront();

  const promises = [
    { icon: Clock, title: content.delivery_promise_1_title, body: content.delivery_promise_1_body },
    { icon: Leaf, title: content.delivery_promise_2_title, body: content.delivery_promise_2_body },
    {
      icon: Flower2,
      title: content.delivery_promise_3_title,
      body: content.delivery_promise_3_body,
    },
    {
      icon: HeartHandshake,
      title: content.delivery_promise_4_title,
      body: content.delivery_promise_4_body,
    },
  ];

  return (
    <section
      data-trail-section
      aria-label="Our delivery promise"
      className="relative z-10 px-4 sm:px-8"
    >
      <div className="bg-fern-panel mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-6 rounded-3xl px-6 py-7 text-fern-foreground shadow-card sm:px-10 lg:grid-cols-4">
        {promises.map(({ icon: Icon, title, body }, i) => (
          <div key={i} className="flex items-start gap-3">
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
