/**
 * server.js — CODE COMBAT LEAGUE v3.0
 * Full 5-level tournament: 50 players → sequential 1v1 → Champion
 */
'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const crypto     = require('crypto');
const { runAllTestCases } = require('./evaluator');

const PORT        = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV    = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function log(level, event, data = {}) {
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ ts: new Date().toISOString(), level, event, ...data })
  );
}

// ─── Challenge Database ──────────────────────────────────────
const CHALLENGES = [
  // EASY (id 1-10)
  { id:1, title:'Array Sum', difficulty:'easy', timeLimit:300,
    desc:'Write a function that returns the sum of all numbers in an array.',
    template:{ javascript:'function solution(arr) {\n    // Your code here\n    \n}', python:'def solution(arr):\n    # Your code here\n    pass' },
    testCases:[{input:[1,2,3,4,5],expected:15},{input:[10,20,30],expected:60},{input:[-1,-2,-3],expected:-6},{input:[0],expected:0},{input:[],expected:0}]
  },
  { id:2, title:'Reverse String', difficulty:'easy', timeLimit:300,
    desc:'Reverse a string without using built-in reverse methods.',
    template:{ javascript:'function solution(str) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'hello',expected:'olleh'},{input:'world',expected:'dlrow'},{input:'a',expected:'a'},{input:'CodeCombat',expected:'tabmoCedoC'},{input:'',expected:''}]
  },
  { id:3, title:'Find Maximum', difficulty:'easy', timeLimit:300,
    desc:'Find the maximum number in an array.',
    template:{ javascript:'function solution(arr) {\n    // Your code here\n    \n}', python:'def solution(arr):\n    # Your code here\n    pass' },
    testCases:[{input:[1,5,3,9,2],expected:9},{input:[-10,-5,-20],expected:-5},{input:[100],expected:100},{input:[7,7,7],expected:7}]
  },
  { id:4, title:'Count Vowels', difficulty:'easy', timeLimit:300,
    desc:'Count vowels (a,e,i,o,u) in a string (case-insensitive).',
    template:{ javascript:'function solution(str) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'Hello World',expected:3},{input:'aeiou',expected:5},{input:'rhythm',expected:0},{input:'',expected:0},{input:'AEIOU',expected:5}]
  },
  { id:5, title:'Is Even', difficulty:'easy', timeLimit:300,
    desc:'Return true if the number is even, false otherwise.',
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:4,expected:true},{input:7,expected:false},{input:0,expected:true},{input:-2,expected:true},{input:-3,expected:false}]
  },
  { id:6, title:'Factorial', difficulty:'easy', timeLimit:300,
    desc:'Compute the factorial of n (n >= 0).',
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:0,expected:1},{input:1,expected:1},{input:5,expected:120},{input:7,expected:5040}]
  },
  { id:7, title:'Remove Duplicates', difficulty:'easy', timeLimit:300,
    desc:'Remove duplicates from an array and return sorted unique values.',
    template:{ javascript:'function solution(arr) {\n    // Your code here\n    \n}', python:'def solution(arr):\n    # Your code here\n    pass' },
    testCases:[{input:[1,2,2,3,3,3],expected:[1,2,3]},{input:[5,5,5],expected:[5]},{input:[1,2,3],expected:[1,2,3]},{input:[],expected:[]}]
  },
  { id:8, title:'Array Product', difficulty:'easy', timeLimit:300,
    desc:'Return the product of all numbers. Return 1 for empty array.',
    template:{ javascript:'function solution(arr) {\n    // Your code here\n    \n}', python:'def solution(arr):\n    # Your code here\n    pass' },
    testCases:[{input:[1,2,3,4],expected:24},{input:[5,5],expected:25},{input:[0,5,10],expected:0},{input:[],expected:1}]
  },
  { id:9, title:'Uppercase Words', difficulty:'easy', timeLimit:300,
    desc:'Capitalize the first letter of each word in a string.',
    template:{ javascript:'function solution(str) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'hello world',expected:'Hello World'},{input:'code combat',expected:'Code Combat'},{input:'a b c',expected:'A B C'}]
  },
  { id:10, title:'Sum Digits', difficulty:'easy', timeLimit:300,
    desc:'Return the sum of digits of a positive integer.',
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:123,expected:6},{input:9999,expected:36},{input:0,expected:0},{input:100,expected:1}]
  },
  // MEDIUM (id 11-20)
  { id:11, title:'Palindrome Check', difficulty:'medium', timeLimit:420,
    desc:'Check if a string reads the same forwards and backwards.',
    template:{ javascript:'function solution(str) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'racecar',expected:true},{input:'hello',expected:false},{input:'a',expected:true},{input:'noon',expected:true},{input:'',expected:true}]
  },
  { id:12, title:'FizzBuzz', difficulty:'medium', timeLimit:420,
    desc:"Return array 1→n: multiples of 3→'Fizz', 5→'Buzz', both→'FizzBuzz'.",
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:5,expected:['1','2','Fizz','4','Buzz']},{input:15,expected:['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']},{input:1,expected:['1']}]
  },
  { id:13, title:'Anagram Check', difficulty:'medium', timeLimit:420,
    desc:'Check if two strings are anagrams (ignore case). Input is [a, b].',
    template:{ javascript:'function solution(pair) {\n    const [a, b] = pair;\n    // Your code here\n    \n}', python:'def solution(pair):\n    a, b = pair\n    # Your code here\n    pass' },
    testCases:[{input:['listen','silent'],expected:true},{input:['hello','world'],expected:false},{input:['abc','cba'],expected:true}]
  },
  { id:14, title:'Fibonacci', difficulty:'medium', timeLimit:420,
    desc:'Return the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1).',
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:0,expected:0},{input:1,expected:1},{input:6,expected:8},{input:10,expected:55}]
  },
  { id:15, title:'Valid Brackets', difficulty:'medium', timeLimit:420,
    desc:'Return true if the bracket string is valid (matched and properly nested).',
    template:{ javascript:'function solution(str) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'()',expected:true},{input:'()[{}]',expected:true},{input:'(]',expected:false},{input:'([)]',expected:false},{input:'',expected:true}]
  },
  { id:16, title:'Flatten Array', difficulty:'medium', timeLimit:420,
    desc:'Flatten a nested array one level deep.',
    template:{ javascript:'function solution(arr) {\n    // Your code here\n    \n}', python:'def solution(arr):\n    # Your code here\n    pass' },
    testCases:[{input:[[1,2],[3,4]],expected:[1,2,3,4]},{input:[[1],[2],[3]],expected:[1,2,3]},{input:[],expected:[]}]
  },
  { id:17, title:'Longest Word', difficulty:'medium', timeLimit:420,
    desc:'Return the longest word in a sentence. If tie, return the first.',
    template:{ javascript:'function solution(sentence) {\n    // Your code here\n    \n}', python:'def solution(sentence):\n    # Your code here\n    pass' },
    testCases:[{input:'the quick brown fox',expected:'quick'},{input:'hello world',expected:'hello'},{input:'a bb ccc',expected:'ccc'}]
  },
  { id:18, title:'Roman Numerals', difficulty:'medium', timeLimit:420,
    desc:'Convert an integer (1-3999) to a Roman numeral string.',
    template:{ javascript:'function solution(n) {\n    // Your code here\n    \n}', python:'def solution(n):\n    # Your code here\n    pass' },
    testCases:[{input:3,expected:'III'},{input:4,expected:'IV'},{input:9,expected:'IX'},{input:58,expected:'LVIII'},{input:1994,expected:'MCMXCIV'}]
  },
  { id:19, title:'Two Sum Indices', difficulty:'medium', timeLimit:420,
    desc:'Given {arr, target}, return indices [i,j] where arr[i]+arr[j]===target.',
    template:{ javascript:'function solution(input) {\n    const { arr, target } = input;\n    // Return [i, j]\n    \n}', python:'def solution(input):\n    arr, target = input["arr"], input["target"]\n    # Return [i, j]\n    pass' },
    testCases:[{input:{arr:[2,7,11,15],target:9},expected:[0,1]},{input:{arr:[3,2,4],target:6},expected:[1,2]},{input:{arr:[3,3],target:6},expected:[0,1]}]
  },
  { id:20, title:'Group Even/Odd', difficulty:'medium', timeLimit:420,
    desc:'Group array elements. Return {even:[...], odd:[...]}.',
    template:{ javascript:'function solution(arr) {\n    // Return { even: [...], odd: [...] }\n    \n}', python:'def solution(arr):\n    # Return {"even": [...], "odd": [...]}\n    pass' },
    testCases:[{input:[1,2,3,4,5],expected:{even:[2,4],odd:[1,3,5]}},{input:[2,4,6],expected:{even:[2,4,6],odd:[]}},{input:[],expected:{even:[],odd:[]}}]
  },
  // HARD (id 21-25)
  { id:21, title:'Binary Search', difficulty:'hard', timeLimit:600,
    desc:'Implement binary search on a sorted array. Return -1 if not found. Input: {arr, target}.',
    template:{ javascript:'function solution(input) {\n    const { arr, target } = input;\n    // Your code here\n    \n}', python:'def solution(input):\n    arr, target = input["arr"], input["target"]\n    # Your code here\n    pass' },
    testCases:[{input:{arr:[1,3,5,7,9,11],target:7},expected:3},{input:{arr:[1,3,5,7,9,11],target:2},expected:-1},{input:{arr:[10,20,30,40,50],target:50},expected:4},{input:{arr:[],target:1},expected:-1}]
  },
  { id:22, title:'Merge Sort', difficulty:'hard', timeLimit:600,
    desc:'Implement merge sort and return the sorted array.',
    template:{ javascript:'function solution(arr) {\n    // Implement merge sort\n    \n}', python:'def solution(arr):\n    # Implement merge sort\n    pass' },
    testCases:[{input:[38,27,43,3,9,82,10],expected:[3,9,10,27,38,43,82]},{input:[5,4,3,2,1],expected:[1,2,3,4,5]},{input:[1],expected:[1]},{input:[],expected:[]}]
  },
  { id:23, title:'Valid Parentheses Extended', difficulty:'hard', timeLimit:600,
    desc:'Minimal window substring: given {s, t}, find the minimum window in s containing all chars of t.',
    template:{ javascript:'function solution(input) {\n    const { s, t } = input;\n    // Sliding window\n    \n}', python:'def solution(input):\n    s, t = input["s"], input["t"]\n    pass' },
    testCases:[{input:{s:'ADOBECODEBANC',t:'ABC'},expected:'BANC'},{input:{s:'a',t:'a'},expected:'a'},{input:{s:'a',t:'aa'},expected:''}]
  },
  { id:24, title:'Longest Palindrome Substring', difficulty:'hard', timeLimit:600,
    desc:'Find the longest palindromic substring.',
    template:{ javascript:'function solution(s) {\n    // Your code here\n    \n}', python:'def solution(s):\n    # Your code here\n    pass' },
    testCases:[{input:'babad',expected:'bab'},{input:'cbbd',expected:'bb'},{input:'a',expected:'a'},{input:'racecar',expected:'racecar'}]
  },
  { id:25, title:'Maximum Subarray', difficulty:'hard', timeLimit:600,
    desc:'Find the contiguous subarray with the largest sum (Kadane\'s algorithm). Return the sum.',
    template:{ javascript:'function solution(arr) {\n    // Kadane\'s algorithm\n    \n}', python:'def solution(arr):\n    # Kadane\'s algorithm\n    pass' },
    testCases:[{input:[-2,1,-3,4,-1,2,1,-5,4],expected:6},{input:[1],expected:1},{input:[-1,-2,-3],expected:-1},{input:[5,4,-1,7,8],expected:23}]
  },
];

const CHALLENGE_MAP = new Map(CHALLENGES.map(c => [c.id, c]));

function safeChallenge(c) {
  return {
    id:c.id, title:c.title, desc:c.desc, difficulty:c.difficulty,
    timeLimit:c.timeLimit, template:c.template,
    testInputs:c.testCases.map(tc => tc.input),
  };
}

// ─── Tournament Engine ───────────────────────────────────────
class TournamentEngine {
  constructor() { this.reset(); }

  reset() {
    this.players      = [];
    this.level        = 0;
    this.matches      = [];
    this.currentMatch = null;
    this.matchIndex   = 0;
    this.levelWinners = [];
    this.byePlayers   = [];
    this.champion     = null;
    this.history      = [];
    this.started      = false;
  }

  addPlayers(players) {
    this.players = players.map((p, i) => ({
      id: p.id || `P${String(i+1).padStart(2,'0')}`,
      name: p.name,
      wins:0, losses:0, byeCount:0,
      level:0, eliminated:false,
    }));
  }

  _pickProblems(level, idx) {
    const easy   = CHALLENGES.filter(c=>c.difficulty==='easy');
    const medium = CHALLENGES.filter(c=>c.difficulty==='medium');
    const hard   = CHALLENGES.filter(c=>c.difficulty==='hard');
    const pick   = (arr,i) => arr[i % arr.length];
    switch(level) {
      case 1: return { primary: pick(easy,   idx),   secondary: null };
      case 2: return { primary: pick(easy,   idx+3), secondary: pick(medium, idx) };
      case 3: return { primary: pick(medium, idx+2), secondary: null };
      case 4: return { primary: pick(medium, idx+4), secondary: pick(hard, idx) };
      case 5: return { primary: pick(hard,   idx),   secondary: null };
      default:return { primary: CHALLENGES[0], secondary: null };
    }
  }

  buildMatches(activePlayers, level) {
    this.level        = level;
    this.matches      = [];
    this.matchIndex   = 0;
    this.levelWinners = [];
    this.byePlayers   = [];
    const players = [...activePlayers];

    if (players.length % 2 !== 0) {
      const byeIdx = players.reduce((min,p,i,arr)=>p.wins<arr[min].wins?i:min, 0);
      const [bp] = players.splice(byeIdx, 1);
      bp.byeCount++;
      this.levelWinners.push(bp);
      this.byePlayers.push(bp);
    }

    for (let i=0; i<players.length; i+=2) {
      const probs = this._pickProblems(level, this.matchIndex);
      this.matches.push({
        id          : crypto.randomBytes(4).toString('hex'),
        matchNum    : this.matches.length+1,
        level,
        p1          : players[i],
        p2          : players[i+1],
        status      : 'pending',
        winner      : null,
        loser       : null,
        primaryProblem  : probs.primary,
        secondaryProblem: probs.secondary,
        startTime   : null,
        endTime     : null,
      });
      this.matchIndex++;
    }
    return this.matches;
  }

  startNextMatch() {
    const m = this.matches.find(m=>m.status==='pending');
    if (!m) return null;
    m.status    = 'active';
    m.startTime = Date.now();
    this.currentMatch = m;
    return m;
  }

  recordMatchResult(matchId, winnerId) {
    const match = this.matches.find(m=>m.id===matchId);
    if (!match || match.status !== 'active') return null;
    match.status  = 'done';
    match.endTime = Date.now();
    const winner  = match.p1.id===winnerId ? match.p1 : match.p2;
    const loser   = match.p1.id===winnerId ? match.p2 : match.p1;
    match.winner  = winner;
    match.loser   = loser;
    winner.wins++;
    loser.losses++;
    this.levelWinners.push(winner);
    this.history.push(match);
    this.currentMatch = null;
    return { winner, loser };
  }

  advanceToNextLevel() {
    const next = this.level + 1;
    if (next > 5) return null;
    const active = [...this.levelWinners];
    if (active.length === 1) {
      this.champion = active[0];
      return { champion: this.champion };
    }
    return this.buildMatches(active, next);
  }

  startTournament(players) {
    this.reset();
    this.addPlayers(players);
    this.started = true;
    return this.buildMatches(this.players, 1);
  }

  isLevelComplete() {
    return this.matches.length > 0 && this.matches.every(m=>m.status==='done');
  }

  getState() {
    return {
      started      : this.started,
      level        : this.level,
      players      : this.players,
      matches      : this.matches.map(m=>({
        ...m,
        primaryProblem  : m.primaryProblem   ? safeChallenge(m.primaryProblem)   : null,
        secondaryProblem: m.secondaryProblem  ? safeChallenge(m.secondaryProblem) : null,
      })),
      currentMatch : this.currentMatch ? {
        ...this.currentMatch,
        primaryProblem  : safeChallenge(this.currentMatch.primaryProblem),
        secondaryProblem: this.currentMatch.secondaryProblem ? safeChallenge(this.currentMatch.secondaryProblem) : null,
      } : null,
      levelWinners : this.levelWinners,
      byePlayers   : this.byePlayers,
      champion     : this.champion,
      history      : this.history.map(m=>({
        ...m,
        primaryProblem  : m.primaryProblem   ? safeChallenge(m.primaryProblem)   : null,
        secondaryProblem: m.secondaryProblem  ? safeChallenge(m.secondaryProblem) : null,
      })),
      totalPlayers  : this.players.length,
      levelComplete : this.isLevelComplete(),
      pendingMatches: this.matches.filter(m=>m.status==='pending').length,
      doneMatches   : this.matches.filter(m=>m.status==='done').length,
      totalMatches  : this.matches.length,
    };
  }
}

// ─── Rate + Eval Queue ───────────────────────────────────────
class RateLimiter {
  constructor(){this._m=new Map()}
  allow(id){const now=Date.now();const r=this._m.get(id)||{n:0,start:now};if(now-r.start>10000){r.n=0;r.start=now}r.n++;this._m.set(id,r);return r.n<=5}
  del(id){this._m.delete(id)}
}
class EvalQueue {
  constructor(){this._m=new Map()}
  enqueue(id,fn){const prev=this._m.get(id)||Promise.resolve();const next=prev.then(()=>fn()).catch(()=>{});this._m.set(id,next);return next}
  del(id){this._m.delete(id)}
}

// ─── Live Battle State ───────────────────────────────────────
let battleState = {
  p1Name:'PLAYER 1', p2Name:'PLAYER 2',
  challengeId:null, timeLimit:0,
  timers:{p1:0,p2:0}, status:{p1:'idle',p2:'idle'},
  finishTime:{p1:null,p2:null}, running:false, paused:false,
};
let timerIntervals = {p1:null,p2:null};

const tournament  = new TournamentEngine();
const rateLimiter = new RateLimiter();
const evalQueue   = new EvalQueue();

// ─── Express + Socket.io ─────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server,{cors:{origin:CORS_ORIGIN,methods:['GET','POST']},pingTimeout:60000,pingInterval:25000});
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get('/health',(_, res)=>res.json({status:'ok',uptime:process.uptime()}));
app.get('/api/challenges',(_, res)=>res.json(CHALLENGES.map(safeChallenge)));
app.get('/api/tournament',(_, res)=>res.json(tournament.getState()));

// ─── Timers ──────────────────────────────────────────────────
function tickTimer(player) {
  clearInterval(timerIntervals[player]);
  timerIntervals[player] = setInterval(()=>{
    if(battleState.timers[player]<=0){clearInterval(timerIntervals[player]);markOut(player);return}
    battleState.timers[player]--;
    io.emit('timer_tick',{player,remaining:battleState.timers[player],danger:battleState.timers[player]<=30});
  },1000);
}
function markOut(player) {
  if(battleState.status[player]==='solved'||battleState.status[player]==='out') return;
  clearInterval(timerIntervals[player]);
  battleState.timers[player]=0; battleState.status[player]='out';
  io.emit('player_out',{player});
  checkBothDone(player);
}
function checkBothDone(changed) {
  const other = changed==='p1'?'p2':'p1';
  if(battleState.status[other]==='solved'||battleState.status[other]==='out') declareWinner();
}
function declareWinner() {
  clearInterval(timerIntervals.p1); clearInterval(timerIntervals.p2);
  battleState.running=false;
  const p1s=battleState.status.p1==='solved', p2s=battleState.status.p2==='solved';
  let winner=null;
  if(p1s&&!p2s) winner='p1';
  else if(p2s&&!p1s) winner='p2';
  else if(p1s&&p2s) winner=battleState.finishTime.p1<=battleState.finishTime.p2?'p1':'p2';

  const cm=tournament.currentMatch;
  if(cm&&winner){
    const wid=winner==='p1'?cm.p1.id:cm.p2.id;
    tournament.recordMatchResult(cm.id,wid);
  }

  io.emit('winner',{winner,p1Name:battleState.p1Name,p2Name:battleState.p2Name,finishTime:battleState.finishTime});
  io.emit('tournament_state',tournament.getState());
}

// ─── Socket.io ───────────────────────────────────────────────
io.on('connection',(socket)=>{
  const role=socket.handshake.query.role||'unknown';
  log('info','connect',{socketId:socket.id,role});
  const ch=battleState.challengeId?CHALLENGE_MAP.get(battleState.challengeId):null;
  socket.emit('state_sync',{...battleState,challengeData:ch?safeChallenge(ch):null});
  socket.emit('tournament_state',tournament.getState());

  // ── TOURNAMENT ──────────────────────────────────────────
  socket.on('tournament_init',({players})=>{
    if(!players||players.length<2){socket.emit('error_event',{message:'Need at least 2 players.'});return}
    tournament.startTournament(players);
    log('info','tournament_started',{count:players.length});
    io.emit('tournament_state',tournament.getState());
    io.emit('tournament_started',{level:1,totalPlayers:players.length});
  });

  socket.on('match_next',()=>{
    const match=tournament.startNextMatch();
    if(!match){
      if(tournament.isLevelComplete()){
        socket.emit('level_complete',{level:tournament.level,winners:tournament.levelWinners,total:tournament.levelWinners.length});
      }
      return;
    }
    const ch=match.primaryProblem;
    battleState={
      p1Name:match.p1.name, p2Name:match.p2.name,
      challengeId:ch.id, timeLimit:ch.timeLimit,
      timers:{p1:ch.timeLimit,p2:ch.timeLimit},
      status:{p1:'idle',p2:'idle'},
      finishTime:{p1:null,p2:null},
      running:false, paused:false,
    };
    io.emit('match_active',{
      matchNum:match.matchNum, level:match.level,
      p1:match.p1, p2:match.p2,
      primaryProblem:safeChallenge(ch),
      secondaryProblem:match.secondaryProblem?safeChallenge(match.secondaryProblem):null,
      matchId:match.id,
    });
    io.emit('setup',{p1Name:battleState.p1Name,p2Name:battleState.p2Name,challengeData:safeChallenge(ch),timeLimit:ch.timeLimit});
    io.emit('tournament_state',tournament.getState());
  });

  socket.on('level_advance',()=>{
    const result=tournament.advanceToNextLevel();
    if(!result) return;
    if(result.champion){io.emit('champion_crowned',{champion:result.champion});io.emit('tournament_state',tournament.getState());return}
    io.emit('level_started',{level:tournament.level,matchCount:tournament.matches.length});
    io.emit('tournament_state',tournament.getState());
  });

  socket.on('match_override',({matchId,winnerId})=>{
    const r=tournament.recordMatchResult(matchId,winnerId);
    if(r){io.emit('match_result_override',{matchId,winner:r.winner});io.emit('tournament_state',tournament.getState())}
  });

  socket.on('tournament_reset',()=>{
    tournament.reset();
    clearInterval(timerIntervals.p1);clearInterval(timerIntervals.p2);
    io.emit('tournament_state',tournament.getState());
    io.emit('tournament_reset');
  });

  // ── HOST BATTLE ─────────────────────────────────────────
  socket.on('setup',(data)=>{
    const ch=CHALLENGE_MAP.get(Number(data.challengeId));
    if(!ch){socket.emit('error_event',{message:`Unknown challenge: ${data.challengeId}`});return}
    const tl=(data.timeLimit>0&&data.timeLimit<=7200)?data.timeLimit:ch.timeLimit;
    battleState={
      p1Name:String(data.p1Name||'PLAYER 1').slice(0,30),
      p2Name:String(data.p2Name||'PLAYER 2').slice(0,30),
      challengeId:ch.id,timeLimit:tl,
      timers:{p1:tl,p2:tl},status:{p1:'idle',p2:'idle'},
      finishTime:{p1:null,p2:null},running:false,paused:false,
    };
    io.emit('setup',{p1Name:battleState.p1Name,p2Name:battleState.p2Name,challengeData:safeChallenge(ch),timeLimit:tl});
  });

  socket.on('start',()=>{
    if(battleState.running) return;
    battleState.running=true;battleState.paused=false;
    battleState.status={p1:'coding',p2:'coding'};
    io.emit('battle_start',{timeLimit:battleState.timeLimit});
    tickTimer('p1');tickTimer('p2');
  });

  socket.on('pause',()=>{
    if(!battleState.running||battleState.paused) return;
    battleState.paused=true;clearInterval(timerIntervals.p1);clearInterval(timerIntervals.p2);
    io.emit('battle_pause');
  });

  socket.on('resume',()=>{
    if(!battleState.running||!battleState.paused) return;
    battleState.paused=false;
    if(battleState.status.p1==='coding') tickTimer('p1');
    if(battleState.status.p2==='coding') tickTimer('p2');
    io.emit('battle_resume');
  });

  socket.on('reset',()=>{
    clearInterval(timerIntervals.p1);clearInterval(timerIntervals.p2);
    battleState.timers={p1:battleState.timeLimit,p2:battleState.timeLimit};
    battleState.status={p1:'idle',p2:'idle'};
    battleState.finishTime={p1:null,p2:null};
    battleState.running=false;battleState.paused=false;
    io.emit('battle_reset',{timeLimit:battleState.timeLimit});
  });

  socket.on('host_mark_solved',({player})=>{
    if(battleState.status[player]==='solved'||battleState.status[player]==='out') return;
    clearInterval(timerIntervals[player]);
    const used=battleState.timeLimit-battleState.timers[player];
    battleState.status[player]='solved';battleState.finishTime[player]=used;
    io.emit('player_solved',{player,timeUsed:used});
    checkBothDone(player);
  });

  socket.on('host_mark_out',({player})=>markOut(player));

  socket.on('host_declare_winner',({player})=>{
    if(player!=='p1'&&player!=='p2') return;
    clearInterval(timerIntervals.p1);clearInterval(timerIntervals.p2);
    battleState.running=false;
    const cm=tournament.currentMatch;
    if(cm){const wid=player==='p1'?cm.p1.id:cm.p2.id;tournament.recordMatchResult(cm.id,wid)}
    io.emit('winner',{winner:player,p1Name:battleState.p1Name,p2Name:battleState.p2Name,finishTime:battleState.finishTime,hostDeclared:true});
    io.emit('tournament_state',tournament.getState());
  });

  // ── PLAYER ──────────────────────────────────────────────
  socket.on('player_connected',({slot})=>{
    io.emit('player_connected',{slot});
    const ch=battleState.challengeId?CHALLENGE_MAP.get(battleState.challengeId):null;
    socket.emit('state_sync',{...battleState,challengeData:ch?safeChallenge(ch):null});
  });

  socket.on('code_update',({slot,code,language})=>io.emit('code_update',{slot,code,language}));

  socket.on('submit_code',(data)=>{
    const {slot,code,language='javascript',isRun=false}=data;
    const player=slot==='1'?'p1':'p2';
    const submitId=crypto.randomBytes(6).toString('hex');

    if(!rateLimiter.allow(socket.id)){
      socket.emit('eval_result',{submitId,slot,isRun,error:'Too many submissions.',allPassed:false,results:[]});return
    }
    const ch=CHALLENGE_MAP.get(battleState.challengeId);
    if(!ch){socket.emit('eval_result',{submitId,slot,isRun,error:'No active challenge.',allPassed:false,results:[]});return}
    if(!isRun&&battleState.status[player]!=='coding'){
      socket.emit('eval_result',{submitId,slot,isRun,error:`Status is "${battleState.status[player]}".`,allPassed:false,results:[]});return
    }

    evalQueue.enqueue(socket.id,async()=>{
      const er=runAllTestCases(code,ch.testCases,{timeoutMs:3000});
      socket.emit('eval_result',{
        submitId,slot,isRun,allPassed:er.allPassed,syntaxError:er.syntaxError,totalTimeMs:er.totalTimeMs,
        results:er.results.map(r=>({testNum:r.testNum,passed:r.passed,reason:r.reason,inputStr:r.inputStr,expectedStr:r.expectedStr,actualStr:r.actualStr,timeMs:r.timeMs,error:r.error,logs:r.logs})),
      });
      io.emit('player_submitted',{slot,allPassed:er.allPassed,totalTimeMs:er.totalTimeMs,isRun});

      if(!isRun&&er.allPassed){
        if(battleState.status[player]==='solved'||battleState.status[player]==='out') return;
        clearInterval(timerIntervals[player]);
        const used=battleState.timeLimit-battleState.timers[player];
        battleState.status[player]='solved';battleState.finishTime[player]=used;
        io.emit('player_solved',{player,timeUsed:used});
        checkBothDone(player);
      }
    });
  });

  socket.on('disconnect',()=>{rateLimiter.del(socket.id);evalQueue.del(socket.id)});
});

process.on('uncaughtException',(err)=>{log('error','uncaught',{message:err.message});if(NODE_ENV==='production')process.exit(1)});
process.on('unhandledRejection',(r)=>log('error','rejection',{reason:String(r)}));

server.listen(PORT,()=>{
  log('info','server_started',{port:PORT});
  console.log(`\n🏆  CODE COMBAT LEAGUE v3.0  →  http://localhost:${PORT}`);
  console.log(`   Admin     →  http://localhost:${PORT}/coding-combat-host.html`);
  console.log(`   Player 1  →  http://localhost:${PORT}/coding-combat-player.html?slot=1`);
  console.log(`   Player 2  →  http://localhost:${PORT}/coding-combat-player2.html\n`);
});
