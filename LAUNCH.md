# Launch and distribution

Live at https://theguysaccount.github.io/life-incremental-game/. Machine channels only: nothing is posted by or as a person, and nothing is sent to anyone.

## Channels that run themselves

| Channel | How |
|---|---|
| Search | The game page ("gamified goal tracker", "goal tracker game", "life RPG", "incremental game for real life"), How it works ("what is prestige", "goal tiers"), and 72 goal ideas ("small goals to achieve this month", "short term goal examples"). Each page has its own title, description, canonical, Open Graph card and structured data (WebApplication, FAQPage, ItemList). |
| IndexNow | Every deploy submits every URL in the live sitemap (Bing, Yandex, Seznam, Naver). |
| Account root | `theguysaccount.github.io/robots.txt` lists this site's sitemap automatically within a day. |
| Share loop | Tier-up and summit cards (PNG, phone share sheet where supported) and challenge links that open the game with "Someone reached High Camp on day 12". |
| GitHub | Public repo with description, topics and README. |

## The first 1,000 players (machine plan)

1. **Days 1–7:** IndexNow covers Bing-family engines. Google needs Search Console (OPERATIONS.md, key 4).
2. **Ongoing:** the goal-ideas page catches "goal ideas" searches and converts with one tap ("Use this" loads the idea into a slot).
3. **Share cards:** every tier-up offers a card. Target once analytics are on (key 3): 15% of tier-ups make a card.

Targets at 14 days, once analytics are on: 1,000 visits, 25% set a goal, 10% finish one (the activation metric).

## Production domain

Not this session's job: the domain rollout session picks and points the domain. The switch is one repository variable plus the Pages custom-domain setting (OPERATIONS.md, key 1). Nothing has been changed in DNS.
