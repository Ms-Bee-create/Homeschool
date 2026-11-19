/* AI School trail: "Run a Game Server for Our Town". Built from the paper trail Mom ran with Ryan on 18 Nov 2026 (AI_SCHOOL_PAPER_TRAIL.md).
   This file is only what the child SEES. The true facts, the question seeds and what a good fix looks like are kept on the server (supabase/functions/_shared/partner.ts),
   so the page never carries the answers. Nothing here is tagged to a standard: codes are added only after they are verified (CLAUDE.md rule 24).
   Facts are plain computer basics; no pictures, links or names are used (rules 1, 25, 27). */
window.AIS_TRAILS = window.AIS_TRAILS || {};
window.AIS_TRAILS["town-server"] = {
  id: "town-server",
  title: "Run a Game Server for Our Town",
  hook: "You are in charge of a server for the whole town. Learn how it works, design it, then find what is broken.",
  minutes: 60,
  stops: [
    { id: "learn", type: "cards", title: "Learn it", minutes: 10, cards: [
      { title: "The town library", text: "A library has a librarian and visitors. A visitor asks for a book. That ask is called a request. The librarian checks the rules (is your card good? are you over the limit?) and either hands over the book or says no. That answer is called a response." },
      { title: "The librarian is a server", text: "A server is like the librarian. It is a computer that waits for requests from other computers, called clients, and answers them by its rules. Your game on your own screen is a client. The shared world lives on the server." },
      { title: "A game server has rules", text: "A game server decides who may join, how many players fit, and what each player is allowed to do. Those decisions are its rules. Rules keep the world fair and safe." },
      { title: "Draw it", text: "Get a piece of paper. Draw three stick-figure visitors on the left, the librarian in the middle, and a shelf of books on the right. Add arrows labeled request and response. You will use this picture in the next stop." }
    ] },
    { id: "teachback", type: "teachback", title: "Teach it back", minutes: 10,
      opening: "Pretend I just woke up and I have never heard of a server. Explain the town library picture to me. Take your time.",
      need: { answers: 4, questions: 3 },
      writeup: "In 2 or 3 sentences of your own, write what you explained well." },
    { id: "build", type: "form", title: "Build it", minutes: 20, intro: "Design your own server for the town. It can hold a Minecraft-style world, a racing game, anything you like.",
      fields: [
        { id: "name", label: "Your server's name", kind: "text", required: true },
        { id: "game", label: "What is the game?", kind: "text", required: true },
        { id: "teams", label: "The server holds 24 players. Split them into equal teams. How many teams?", kind: "number", required: true },
        { id: "size", label: "How many players on each team?", kind: "number", required: true },
        { id: "two", label: "A second server doubles the room. How many players can the town hold now?", kind: "number", required: true },
        { id: "three", label: "Add a third server of the same size. How many players can the town hold?", kind: "number", required: true },
        { id: "style", label: "Pick ONE way to write your rules. Try a different one next time.", kind: "select", required: true, options: [["how-to", "How-to: steps to join the server"], ["persuasive", "Persuasive: why a friend should join"], ["informational", "Informational: a welcome sign that explains the rules"]] },
        { id: "rules", label: "Write five rules, one on each line. First say what the server is. Give one detail for each rule.", kind: "textarea", required: true },
        { id: "test", label: "How will you test it? Try to break it. Name three things a player might do and what you think will happen. Bug words you can use: stuck, crashes, wrong answer, too slow, unfair.", kind: "textarea", required: true }
      ],
      checks: [
        { type: "product", fields: ["teams", "size"], equals: 24, say: "Teams times players on each team has to make 24. Check your multiplication." },
        { type: "equals", field: "two", value: 48, say: "Not yet. Each server holds 24, and you have two servers." },
        { type: "equals", field: "three", value: 72, say: "Not yet. Each server holds 24, and you have three servers." },
        { type: "lines", field: "rules", min: 5, say: "Write five rules, one on each line." },
        { type: "words", field: "test", min: 8, say: "Say a little more: three things a player might do and what you think will happen." }
      ] },
    { id: "restate", type: "restate", title: "Let me get this straight", minutes: 5, rounds: 2,
      intro: "Your partner will say your design back in its own words. Sometimes it gets a detail wrong. Sometimes it is exactly right. Your job is to decide which, and say why." },
    { id: "bugs", type: "bugs", title: "Fix the broken rules", minutes: 5,
      intro: "Here is a rule list for a town server. Every rule has a problem. For each one, say what is wrong, how you would fix it, and how you would check your fix.",
      rules: [
        "Everyone who joins can use the 'delete the whole world' command.",
        "The server holds 20 players. When 25 try to join, the 21st through 25th are let in anyway.",
        "The server owner can build. Nobody else can build or even move. (The game is a building game.)",
        "Players may share private details about themselves in chat so friends can visit.",
        "If a rule is unclear, do whatever the loudest player says."
      ], needGood: 3, words: ["stuck", "crashes", "wrong answer", "too slow", "unfair"] },
    { id: "grownup", type: "note", title: "Show a grown-up", minutes: 5,
      prompt: "Show your page to a grown-up. Then write: what did you change, and how did you check it?", minWords: 8 }
  ]
};
