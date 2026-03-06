const KEYWORDS = [
  { group: 'Intent signals', items: ['where can I walk', 'walkable neighborhood', 'walkable area', 'most walkable', 'walk to everything', 'walk everywhere', 'no car needed', 'without a car', 'car free living'] },
  { group: 'Safety concerns', items: ['safe to walk', 'safe for walking', 'dangerous intersection', 'dangerous crosswalk', 'pedestrian death', 'pedestrian killed', 'hit by a car', 'killed while walking', 'struck by a car'] },
  { group: 'Brand', items: ['streetsandcommons', 'streets and commons', 'safestreets walkability'] },
  { group: 'Topic', items: ['walkability score', '15-minute city', '15-minute neighborhood', 'walk score', 'pedestrian friendly', 'pedestrian infrastructure'] },
];

const SUBREDDITS = [
  'r/FirstTimeHomeBuyer', 'r/realestate', 'r/homebuying', 'r/moving', 'r/ApartmentHunting',
  'r/walkable_cities', 'r/walkablecities', 'r/carfree', 'r/urbanplanning', 'r/Urbanism',
  'r/transit', 'r/SameGrassButGreener', 'r/CityComparisons',
];

export default function RedditAlerts() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Reddit Alerts</h1>
        <a
          href="https://f5bot.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#e07850' }}
        >
          Open F5Bot ↗
        </a>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">How it works</h2>
        <p className="text-sm text-gray-500 mb-4">
          F5Bot monitors Reddit (and Hacker News) for keywords and emails you instantly — free, no code, no maintenance.
          Add the keywords below to catch every relevant post.
        </p>
        <div className="flex gap-3">
          <a
            href="https://f5bot.com/sign-up"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            1. Create free account
          </a>
          <a
            href="https://f5bot.com/add"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            2. Add keywords
          </a>
        </div>
      </div>

      <div className="space-y-4">
        {KEYWORDS.map(({ group, items }) => (
          <div key={group} className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{group}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map(kw => (
                <span
                  key={kw}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono cursor-default select-all"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Subreddits to watch (optional — filter in F5Bot)</h3>
          <div className="flex flex-wrap gap-2">
            {SUBREDDITS.map(sub => (
              <span
                key={sub}
                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-mono cursor-default select-all"
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-gray-400">
        F5Bot sends an email within minutes of a match. Free tier supports up to 10 keywords — upgrade to premium ($5/mo) for unlimited.
      </p>
    </div>
  );
}
