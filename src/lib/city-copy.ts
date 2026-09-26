import type { CityId } from "../types.ts";

/** Written copy per city. Search engines reward text a person wrote over a list of rows. */
export const CITY_COPY: Record<CityId, { intro: string; scene: string; when: string }> = {
  "chiang-mai": {
    intro:
      "Chiang Mai runs a smaller and more seasonal event calendar than Bangkok, but a denser one " +
      "than its size suggests. The old city and the Nimmanhaemin district carry most of it: " +
      "co-working meetups and startup nights around Nimman, live music in the bars off Loi Kroh " +
      "and Tha Phae Gate, craft markets in the temple courtyards, and yoga, meditation and " +
      "wellness retreats in the Mae Rim and Hang Dong valleys just outside town.",
    scene:
      "The audience here is unusual. Chiang Mai has one of the largest remote-working populations " +
      "in Southeast Asia, so weekday daytime events — coworking socials, language exchanges, " +
      "founder breakfasts — draw crowds that would only turn out at weekends elsewhere. That " +
      "makes the venues hosting them, cafés and coworking spaces as often as bars, a different " +
      "set of partners from the ones a nightlife-led city produces.",
    when:
      "The calendar peaks between November and February, in the cool season. Yi Peng and Loy " +
      "Krathong in November fill the city and push events out to the lantern sites north of " +
      "town; the Flower Festival follows in early February. April brings Songkran. The rainy " +
      "months from June to September are the quietest, and listings thin out accordingly.",
  },
  bangkok: {
    intro:
      "Bangkok has the deepest event calendar in Thailand by a wide margin, and it is the only " +
      "Thai city with a year-round electronic music scene substantial enough to sustain " +
      "dedicated clubs. Listings cluster along Sukhumvit and in Thonglor, Ekkamai and Ari, with " +
      "trade shows and conferences running separately at the big halls — BITEC in Bang Na, " +
      "QSNCC by Benjakitti Park, and IMPACT out at Muang Thong Thani.",
    scene:
      "Two distinct markets sit side by side. The nightlife end is promoter-led: the name to " +
      "know is often the collective running the night rather than the venue, and the same " +
      "promoter moves between rooms month to month. The corporate end is venue-led, booked far " +
      "in advance through hotels and convention centres. A partner list for Bangkok that treats " +
      "those as one category will miss half of it.",
    when:
      "Activity holds up all year, dipping only in the heaviest rain around September and during " +
      "Songkran in April, when much of the city empties. The cool season from November to " +
      "February is the busiest stretch, and the international festival circuit lands in that " +
      "window.",
  },
  phuket: {
    intro:
      "Phuket's calendar is beach-club and resort driven, and more concentrated than the other " +
      "two cities — both in geography and in time. Patong carries the nightlife, while the " +
      "west-coast beach clubs from Kamala down to Kata run daytime-into-evening parties that " +
      "double as the island's main music venues. Phuket Town's old quarter hosts a quieter " +
      "programme of markets and festivals.",
    scene:
      "Almost everything here is tourism-facing, which changes who is worth partnering with. " +
      "The venues are large, international and used to working with brands, and a single " +
      "operator often runs several sites across the island. Event volume tracks arrivals rather " +
      "than a local audience, so the calendar moves with the flight schedule.",
    when:
      "High season runs November to April, and that is when the beach clubs book international " +
      "acts. The monsoon from May to October brings rough seas on the west coast and a much " +
      "thinner calendar. The Vegetarian Festival in the ninth lunar month is the island's " +
      "biggest cultural event and fills Phuket Town.",
  },
};
