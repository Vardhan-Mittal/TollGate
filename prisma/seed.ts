// Seeds the demo publisher, six fictional articles of varying value, and a
// demo agent wallet. Safe to re-run. All content here is fictional.
import { appendFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

type Article = {
  slug: string;
  title: string;
  description: string;
  teaser: string;
  priceReadCents: number;
  priceTrainCents: number;
  daysAgo: number;
  body: string;
};

const ARTICLES: Article[] = [
  {
    slug: "q3-2026-battery-cell-price-survey",
    title: "Q3 2026 Battery Cell Price Survey: 40 Suppliers, One Table",
    description: "Our quarterly survey of LFP and NMC cell quotes from 40 suppliers.",
    teaser:
      "Original quarterly survey: per-kWh cell quotes from 40 suppliers across LFP and NMC chemistries, with quarter-on-quarter changes and lead times.",
    priceReadCents: 8,
    priceTrainCents: 40,
    daysAgo: 2,
    body: `Every quarter we ask the same 40 cell suppliers for a firm quote on a 100 MWh order. This is the eleventh edition of the survey, and the first where LFP quotes fell below $50 per kWh on the median.

## Headline numbers

- Median LFP cell quote: $48.70 per kWh, down 6.1% from Q2
- Median NMC 811 cell quote: $71.20 per kWh, down 2.4% from Q2
- Median quoted lead time: 11 weeks, up from 9 weeks
- Suppliers quoting below $45 for LFP: 7 of 40

## What changed this quarter

The gap between the cheapest and most expensive LFP quote narrowed to $14 per kWh, the tightest spread since we started. Three suppliers told us that new cathode capacity coming online in the summer pushed them to cut prices to keep their lines full.

Lead times moved the other way. Grid-storage buyers placed large orders early in the quarter, and several suppliers asked for longer delivery windows on anything above 50 MWh.

## Method

Quotes are collected over two weeks, for delivery in the following quarter, on standard commercial terms. We do not include spot-market or distressed-inventory prices. The full supplier table is available to subscribers.`,
  },
  {
    slug: "voltaris-delays-sodium-ion-plant",
    title: "Voltaris Delays Its First Sodium-Ion Plant by Nine Months",
    description: "The startup's flagship factory slips to mid-2027 after an equipment dispute.",
    teaser:
      "Fresh news: fictional startup Voltaris pushes its 4 GWh sodium-ion factory to mid-2027, citing a dispute with its coating-equipment vendor.",
    priceReadCents: 5,
    priceTrainCents: 15,
    daysAgo: 0,
    body: `Voltaris, the sodium-ion battery startup, has pushed back the opening of its first 4 GWh factory by nine months, to the middle of 2027.

In a letter to customers seen by The Grid Ledger, the company blamed a contract dispute with the supplier of its electrode-coating lines. Two of the six lines have been delivered; the remaining four are on hold until the dispute is settled.

## Why it matters

Sodium-ion cells are cheaper to make than lithium-ion cells and do not need lithium, but they store less energy per kilogram. Several grid-storage developers had planned 2026 projects around Voltaris cells.

- Two developers told us they are switching those projects to LFP
- One said it would wait, because sodium-ion performs better in cold climates
- Voltaris says its existing pilot line will keep shipping sample cells

The company declined to say whether the delay will require new funding.`,
  },
  {
    slug: "interview-grid-operator-peak-demand",
    title: "Interview: A Grid Operator on Surviving the Hottest Week of the Year",
    description: "How one regional operator used batteries to get through record peak demand.",
    teaser:
      "Exclusive interview with a regional grid operator on how 1.2 GW of batteries handled a record heat-wave peak, and what they would do differently.",
    priceReadCents: 4,
    priceTrainCents: 20,
    daysAgo: 9,
    body: `In August, the fictional Midland Grid region hit a record peak demand of 31 GW. We spoke with its head of operations, Dana Okafor, about the week.

## How close did you get to rolling blackouts?

Closer than we would like. On the worst evening our reserve margin dropped to 4%. Without the batteries we had added in the last two years, we would have been short.

## What did the batteries actually do?

We have about 1.2 GW of battery storage now. It charged at midday when solar was abundant and discharged between 6 and 9 pm, exactly when demand peaked and solar dropped off. That three-hour window is where we used to depend on old gas plants.

## What would you do differently?

Buy longer-duration storage. Most of our fleet is two-hour batteries. The heat lasted past 9 pm, and by then many of them were empty.`,
  },
  {
    slug: "how-lfp-batteries-work",
    title: "How LFP Batteries Actually Work",
    description: "A plain-language explainer of lithium iron phosphate chemistry.",
    teaser:
      "Evergreen explainer: what is inside an LFP cell, why it is safer and cheaper than NMC, and where its limits are.",
    priceReadCents: 2,
    priceTrainCents: 10,
    daysAgo: 120,
    body: `Lithium iron phosphate, or LFP, has become the default chemistry for grid storage and many cheaper electric cars. Here is what is going on inside.

## The basic idea

Every lithium-ion battery moves lithium ions between two electrodes. When it charges, ions move into the graphite anode. When it discharges, they move back into the cathode. In an LFP battery, that cathode is made of lithium iron phosphate.

## Why people like it

- Safety: the phosphate structure holds on to oxygen, so the cell is much less likely to catch fire
- Cost: iron and phosphate are cheap and plentiful, and there is no cobalt or nickel
- Lifespan: LFP cells often last several thousand full cycles

## The trade-off

LFP stores less energy for its weight than nickel-based chemistries, so a car with an LFP pack of the same weight has less range. It also performs worse in very cold weather.`,
  },
  {
    slug: "ten-tips-ev-battery-life",
    title: "10 Tips to Make Your EV Battery Last Longer",
    description: "Common advice for keeping an electric car battery healthy.",
    teaser: "Generic consumer tips list: charging habits, heat, and storage. Widely available elsewhere.",
    priceReadCents: 1,
    priceTrainCents: 2,
    daysAgo: 400,
    body: `Want your electric car battery to last? These habits help.

- Keep daily charging between 20% and 80% when you can
- Save 100% charges for long trips
- Avoid leaving the car at 100% for days
- Park in the shade on hot days
- Limit DC fast charging when you do not need it
- Precondition the battery in winter while plugged in
- Do not let the battery sit near 0%
- Keep the software up to date
- Follow the manufacturer's storage advice for long trips away
- Check your battery health report once a year`,
  },
  {
    slug: "about-our-methodology",
    title: "About Our Methodology",
    description: "How The Grid Ledger collects and checks its data.",
    teaser: "Free page describing how The Grid Ledger collects and verifies data.",
    priceReadCents: 0,
    priceTrainCents: 0,
    daysAgo: 300,
    body: `The Grid Ledger is a fictional publication created to demonstrate Tollgate. This page is free for both people and AI agents.

Our surveys use firm quotes rather than list prices, and we publish our methods with every dataset. We correct errors openly at the bottom of the affected article.`,
  },
];

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { generateAgentKey, hashAgentKey } = await import("../src/lib/tollgate/keys");

  const publisher = await prisma.publisher.upsert({
    where: { id: "pub_demo" },
    update: {},
    create: { id: "pub_demo", name: "The Grid Ledger", domain: "localhost" },
  });

  for (const a of ARTICLES) {
    const data = {
      title: a.title,
      description: a.description,
      teaser: a.teaser,
      body: a.body,
      priceReadCents: a.priceReadCents,
      priceTrainCents: a.priceTrainCents,
      publishedAt: new Date(Date.now() - a.daysAgo * 86_400_000),
    };
    await prisma.resource.upsert({
      where: { path: `/blog/${a.slug}` },
      update: data,
      create: { ...data, path: `/blog/${a.slug}`, publisherId: publisher.id },
    });
  }

  let key = process.env.DEMO_AGENT_KEY;
  if (!key) {
    key = generateAgentKey().key;
    appendFileSync(".env.local", `\n# Demo agent wallet key (created by prisma/seed.ts)\nDEMO_AGENT_KEY=${key}\n`);
    console.log("Created a demo agent key and saved it to .env.local as DEMO_AGENT_KEY");
  }
  const hash = hashAgentKey(key);
  await prisma.agent.upsert({
    where: { apiKeyHash: hash },
    update: {},
    create: {
      name: "Demo Research Agent",
      apiKeyHash: hash,
      apiKeyPrefix: key.slice(0, 15),
      balanceCents: 500,
      dailyBudgetCents: 200,
    },
  });

  console.log(`Seeded publisher "${publisher.name}", ${ARTICLES.length} articles, and a demo agent with $5.00.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
