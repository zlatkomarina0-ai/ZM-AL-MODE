export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const SPORTLIFE_API_URL = "https://sportlife.com.mk";
    try {
      const response = await fetch(SPORTLIFE_API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://sportlife.com.mk"
        }
      });
      if (!response.ok) return new Response(JSON.stringify({ error: "Грешка Sport Life" }), { status: response.status, headers: corsHeaders });
      const rawData = await response.json();
      const matches = rawData.matches || rawData.data || [];
      const cleanSchedule = matches.map(match => ({
        sifra: match.code || match.id,
        home: match.homeTeam || match.team1,
        away: match.awayTeam || match.team2,
        date: match.matchDate || match.date
      }));
      return new Response(JSON.stringify(cleanSchedule), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
};
