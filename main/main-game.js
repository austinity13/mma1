// ═══════════════════════════════════════════════════════════════════════════
// IRON CAGE — MMA Manager
// game.js — Constants, state, fighter generation, matchmaking, schedule,
//            training, week logic, rendering (dashboard/training/matchmaking/
//            org/rankings/prospects/schedule), init
// ═══════════════════════════════════════════════════════════════════════════


// ===================== DATA =====================
const DIVISIONS = ['Heavyweight','Light Heavyweight','Middleweight','Welterweight','Lightweight','Featherweight','Bantamweight','Flyweight'];
const COLORS    = ['#8B0000','#004080','#005A00','#6B006B','#804000','#003A50','#5A3000','#1A4A4A'];
const DIV_WEIGHTS = {'Heavyweight':'265 lbs','Light Heavyweight':'205 lbs','Middleweight':'185 lbs','Welterweight':'170 lbs','Lightweight':'155 lbs','Featherweight':'145 lbs','Bantamweight':'135 lbs','Flyweight':'125 lbs'};

// Country-grouped name pools — first/last names match nationality for realism
const NAME_POOLS = {
  USA: {
    first:['Tyler','Marcus','Darius','Jake','Cody','Brandon','Dustin','Michael','Calvin','Ryan',
           'Jordan','Derek','Kevin','Robbie','Anthony','James','Eric','Chris','Justin','Aaron',
           'Devin','Logan','Hunter','Austin','Cole','Garrett','Blake','Trevor','Dylan','Bryce',
           'Nate','Elijah','Malik','Deon','Jamal','Terrell','Quincy','Rashad','Lamont','Devon'],
    last: ['Stone','Walker','Brooks','Hunter','Ford','Hall','Thompson','Edwards','Johnson','Smith',
           'Williams','Jones','Brown','Davis','Miller','Wilson','Taylor','Anderson','Jackson','White',
           'Harris','Martin','Garcia','Martinez','Robinson','Clark','Lewis','Lee','Allen','Young',
           'Hernandez','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams']
  },
  Brazil: {
    first:['Carlos','Diego','Mateo','Rafael','Leandro','Edson','Andre','Davi','Thiago','Rodrigo',
           'Felipe','Gabriel','Leonardo','Marcos','Paulo','Victor','Alexandre','Bruno','Caio','Fabio',
           'Glover','Ronaldo','Vinicius','Wellington','Yuri','Augusto','Claudinho','Elizeu','Jadson','Renan'],
    last: ['Silva','Santos','Pereira','Costa','Rodrigues','Oliveira','Souza','Lima','Ferreira','Alves',
           'Barbosa','Carvalho','Melo','Ribeiro','Araujo','Cunha','Gomes','Lopes','Machado','Martins',
           'Nogueira','Palhares','Queiroz','Ramos','Teixeira','Andrade','Belfort','Miocic','Nunes','Figueiredo']
  },
  Russia: {
    first:['Ivan','Dmitri','Artem','Nikita','Alexei','Sergei','Mikhail','Andrei','Viktor','Pavel',
           'Boris','Kirill','Maxim','Ruslan','Evgeny','Vadim','Oleg','Grigor','Timur','Roman'],
    last: ['Volkov','Pavlovich','Kovalev','Morozov','Petrov','Orlov','Sokolov','Fedorov','Novikov','Kozlov',
           'Popov','Lebedev','Sobolev','Bogdanov','Gusev','Karpov','Smirnov','Sidorov','Nikitin','Antonov']
  },
  UK: {
    first:['Tom','Jack','Liam','Harry','Paddy','Dan','Leon','Karl','Nathaniel','Che',
           'Bradley','Craig','Ryan','Michael','Josh','Sam','Ben','Lewis','Adam','Darren'],
    last: ['Aspinall','Whitaker','Hardy','Vettori','Shore','Parke','Hall','Smith','Foster','Lane',
           'Johnson','Thompson','Edwards','Clarke','Walker','Roberts','Turner','Phillips','Campbell','Mitchell']
  },
  Ireland: {
    first:['Conor','Paddy','Paul','Oisin','Cian','Declan','Cathal','Brendan','Sean','Kieran',
           'Darren','Peter','Joseph','Ciaran','Aidan','Niall','Eoin','Donal','Shane','Fionn'],
    last: ['Murphy','Kelly','Walsh','Burke','OBrien','OConnor','McCarthy','OSullivan','Doyle','Brennan',
           'Dunne','Collins','Daly','Kennedy','Lynch','Quinn','Reilly','Ryan','Sheridan','Ward']
  },
  Australia: {
    first:['Jake','Tyson','Kyle','Tai','Rob','Mark','James','Nathan','Dylan','Wade',
           'Liam','Shane','Daniel','Casey','Brad','Scott','Jamie','Todd','Brett','Corey'],
    last: ['Volkanovski','Tuivasa','Matthews','Pearson','Hardy','Hunt','Kelly','Hamill','Riddle','Tafa',
           'Green','Murray','Anderson','Thompson','Clarke','Robertson','Campbell','Mitchell','Evans','White']
  },
  Mexico: {
    first:['Luis','Miguel','Carlos','Alejandro','Juan','Jorge','Roberto','Ernesto','Marco','Cesar',
           'Eduardo','Hector','Gustavo','Raul','Arturo','Francisco','Antonio','Manuel','Pablo','Ricardo'],
    last: ['Vega','Diaz','Cruz','Rivera','Morales','Garcia','Lopez','Hernandez','Torres','Reyes',
           'Dominguez','Flores','Gutierrez','Jimenez','Mendez','Ortega','Ramos','Vargas','Espinoza','Fuentes']
  },
  Japan: {
    first:['Kazuki','Ryo','Yusuke','Tatsuya','Naoya','Shinya','Hideki','Kenji','Takashi','Hiroshi',
           'Yuki','Daichi','Sho','Ryota','Kenta','Daisuke','Taro','Koji','Makoto','Yuji'],
    last: ['Yamamoto','Tanaka','Nakamura','Suzuki','Watanabe','Ito','Kobayashi','Kato','Yoshida','Yamada',
           'Sasaki','Matsumoto','Inoue','Kimura','Hayashi','Shimizu','Yamazaki','Mori','Abe','Ikeda']
  },
  Korea: {
    first:['Doo-Ho','Chan-Sung','Jung','Min-Soo','Hyun-Gyu','Dong-Hyun','Yair','Jun','Seung-Woo','Sang-Hoon'],
    last: ['Choi','Kim','Park','Lee','Jung','Kang','Cho','Yoon','Lim','Han','Oh','Shin','Kwon','Song','Hwang']
  },
  Kazakhstan: {
    first:['Islam','Shavkat','Merab','Khabib','Akhmed','Rustam','Magomed','Shamil','Aslan','Bekzod',
           'Damir','Erlan','Galym','Yerlan','Zhanibek','Aibek','Daniyar','Nursultan','Temirlan','Azamat'],
    last: ['Makhachev','Rakhmonov','Dvalishvili','Nurmagomedov','Umarov','Chimaev','Aliev','Musaev',
           'Khasanov','Bekmurzaev','Tokov','Ankalaev','Isaev','Yusupov','Tashkentov','Sadvokasov','Akhmetov','Rasulov']
  },
  Dagestan: {
    first:['Khabib','Islam','Umar','Tagir','Movsar','Zubaira','Arman','Shamil','Magomed','Said',
           'Gadzhimurad','Ibragim','Gadzhi','Zaurbek','Rasul','Musa','Khalid','Abubakar','Turpal','Apti'],
    last: ['Nurmagomedov','Makhachev','Umarov','Musaev','Evloev','Tukhugov','Tsarukyan','Ibragimov',
           'Khasbulaev','Saidov','Gadzhiev','Aliaskhab','Daudov','Magomadov','Abdulvakhabov','Umalatov']
  },
  China: {
    first:['Li','Wang','Zhang','Liu','Chen','Yang','Wu','Zhao','Tang','Xu',
           'Yan','Wei','Zhu','Lin','He','Guo','Ma','Luo','Hu','Song'],
    last: ['Wei','Feng','Xiong','Zhao','Zhang','Liu','Chen','Yang','Wu','Wang',
           'Li','Sun','Zhou','Xu','Guo','He','Ma','Lin','Luo','Hu']
  },
  Sweden: {
    first:['Alexander','Ilir','David','Joel','Mikael','Erik','Robin','Filip','Viktor','Pontus',
           'Magnus','Andreas','Jonas','Stefan','Henrik','Marcus','Niklas','Kristoffer','Oscar','Anton'],
    last: ['Gustafsson','Latifi','Teymur','Eklund','Lindstrom','Pettersson','Andersson','Karlsson','Nilsson','Eriksson',
           'Johansson','Svensson','Magnusson','Berg','Holm','Lindqvist','Bergstrom','Hedman','Nordin','Wikman']
  },
  Poland: {
    first:['Jan','Mateusz','Michal','Pawel','Krzysztof','Marcin','Lukasz','Rafal','Tomasz','Piotr',
           'Bartosz','Kamil','Maciej','Grzegorz','Jakub','Artur','Marek','Wojciech','Dariusz','Slawomir'],
    last: ['Blachowicz','Gamrot','Oleksiejczuk','Pudzianowski','Jotko','Wrzesien','Faber','Masny','Khalidov','Parke',
           'Wisniewski','Kowalski','Nowak','Wojcik','Lewandowski','Kaminski','Grabowski','Pawlak','Mazur','Witek']
  },
  SouthAfrica: {
    first:['Dricus','Naldo','Wilhelm','Ruan','Brendan','Gavin','Heinrich','Francois','Riaan','Leon',
           'Warren','Kyle','Grant','Carel','Jacques','Werner','Stefan','Louis','Pierre','Johan'],
    last: ['Du Plessis','Venter','Joubert','Botha','Nel','Steyn','Van der Berg','Dlamini','Nkosi','Smit',
           'Van Zyl','Pieterse','Booysen','Erasmus','Fourie','Jacobs','Kotze','Louw','Muller','Pretorius']
  },
  Nigeria: {
    first:['Sodiq','Arnold','Chidi','Emeka','Femi','Gbenga','Jide','Kunle','Lekan','Muyiwa',
           'Niyi','Olu','Tunde','Uche','Wale','Yemi','Zak','Adebayo','Babatunde','Chukwuemeka'],
    last: ['Yusuff','Allen','Okafor','Adeyemi','Babatunde','Chukwu','Eze','Fakoya','Gbadebo','Hassan',
           'Idowu','Jegede','Kehinde','Lawal','Musa','Nduka','Obi','Owusu','Taiwo','Ugo']
  },
  Georgia: {
    first:['Giga','Merab','Giorgi','Lasha','David','Zurab','Tornike','Irakli','Levan','Saba',
           'Nikoloz','Vakhtang','Mamuka','Revaz','Khvicha','Giorgi','Beka','Nika','Zura','Lado'],
    last: ['Chikadze','Dvalishvili','Tsiskaridze','Shalamberidze','Kvaratskhelia','Mchedlidze','Arabuli',
           'Beridze','Bregvadze','Chikhladze','Gogua','Gvenetadze','Jishkariani','Kapanadze','Lobjanidze']
  },
  NewZealand: {
    first:['Kai','Tane','Jordan','Mark','James','Luke','Nathan','Dylan','Jai','Corey',
           'Brad','Scott','Jamie','Todd','Sione','Manu','Toa','Hemi','Rawiri','Wiremu'],
    last: ['Kara-France','Tafa','Hunt','Kelly','Hamill','Riddle','Andrews','Murray','Robertson','Campbell',
           'Mitchell','Evans','White','Harris','Taylor','Brown','Wilson','Thompson','Davis','Clarke']
  },
  Canada: {
    first:['Rory','Mark','Jordan','Sam','Jason','Kyle','Sheldon','Elias','Chris','Olivier',
           'Patrick','Cody','Phil','Charles','Jonathan','Marc-Andre','Jean','Alexis','Mathieu','Nicolas'],
    last: ['MacDonald','Hominick','Mein','Stout','Day','Nelson','Goodman','Theodorou','Leblanc','Aubin-Mercier',
           'Parenteau','Lauzon','Lavigne','Roy','Dumont','Tremblay','Gagnon','Cote','Belanger','Pichel']
  },
  Turkey: {
    first:['Murat','Ali','Serkan','Hakan','Emre','Burak','Cengiz','Fatih','Kerem','Mehmet',
           'Ozan','Tayfun','Volkan','Yilmaz','Zeki','Ahmet','Baris','Can','Deniz','Erkan'],
    last: ['Demir','Kaya','Sahin','Yilmaz','Celik','Aslan','Ozturk','Arslan','Bulut','Dogan',
           'Erdogan','Guler','Kahraman','Korkmaz','Kurt','Polat','Simsek','Tekin','Toprak','Uysal']
  }
};
const ALL_COUNTRIES = Object.keys(NAME_POOLS);
const COUNTRY_FLAGS = {
  USA:'🇺🇸', Brazil:'🇧🇷', Russia:'🇷🇺', UK:'🇬🇧', Ireland:'🇮🇪',
  Australia:'🇦🇺', Mexico:'🇲🇽', Japan:'🇯🇵', Korea:'🇰🇷', Kazakhstan:'🇰🇿',
  Dagestan:'🇷🇺', China:'🇨🇳', Sweden:'🇸🇪', Poland:'🇵🇱', SouthAfrica:'🇿🇦',
  Nigeria:'🇳🇬', Georgia:'🇬🇪', NewZealand:'🇳🇿', Canada:'🇨🇦', Turkey:'🇹🇷'
};
const COUNTRY_DISPLAY = {
  USA:'USA', Brazil:'Brazil', Russia:'Russia', UK:'UK', Ireland:'Ireland',
  Australia:'Australia', Mexico:'Mexico', Japan:'Japan', Korea:'Korea', Kazakhstan:'Kazakhstan',
  Dagestan:'Dagestan', China:'China', Sweden:'Sweden', Poland:'Poland', SouthAfrica:'South Africa',
  Nigeria:'Nigeria', Georgia:'Georgia', NewZealand:'New Zealand', Canada:'Canada', Turkey:'Turkey'
};
const NICKNAMES = [
  'The Predator','Iron','The Spider','Bones','Stylebender','The Eagle','Diamond',
  'The Notorious','The Chosen One','El Matador','The Hurt Business','Borz','Blessed',
  'The Reaper','The Ghost','Lightning','The Assassin','El Cucuy','The Black Beast',
  'Thor','The Eraser','The Boogeyman','El Pantera','The Phenom','Chaos','The Rock',
  'The Natural Born Killer','Overtime','The Ultimate Fighter','Danger','The Sandman',
  'The Street Jesus','The Juggernaut','Money','The Mongoose','The Prodigy',
  'The American Gangster','The Animal','The Lion','The Pitbull','El Toro','The Bull',
  'El Cucuy','The Marksman','Thunder','Rumble','Suga','The Alchemist',
  null,null,null,null,null,null
];
const STYLES = ['Striker','Wrestler','BJJ Artist','Muay Thai','Kickboxer','All-Rounder','Pressure Fighter','Counter-Striker','Brawler'];
function pickNat(){
  // USA appears ~3x more often than any other single country (~30% of pool)
  const weighted = [];
  ALL_COUNTRIES.forEach(c=>{ weighted.push(c); if(c==='USA'){ weighted.push(c); weighted.push(c); } });
  const country = pick(weighted);
  return { country, flag: COUNTRY_FLAGS[country], display: COUNTRY_DISPLAY[country] };
}
function pickName(nat){
  const pool = NAME_POOLS[nat.country] || NAME_POOLS.USA;
  return { first: pick(pool.first), last: pick(pool.last) };
}
const FINISHES = ['KO','TKO','Submission','Decision'];

let G = {
  week: 1,
  money: 250000,
  rep: 42,
  roster: [],
  freeAgents: [],
  opponents: [],       // world-pool fighters (ranked + unranked per division)
  schedule: [],
  news: [],
  selectedFighter: null,
  selectedOpponent: null,
  pendingFight: null,
  totalWins: 0,
  totalLosses: 0,
  trainingSelections: {},
  prospects: [],
  autoCutPending: [],
  consecutiveLosses: {},
  scheduledFights: [],
  pendingOffer: null,
  bookedFighters: new Set(),
  agencyName: '',
};

function rnd(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function pick(arr){return arr[rnd(0,arr.length-1)];}
function fmtMoney(n){return '$'+n.toLocaleString();}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

// ─────────────────────────────────────────────────────────────────────────────
// STAT SYSTEM
// Each fighter has a full tree of granular stats grouped into 4 pillars.
// Style biases tilt the distribution; div bonuses tilt physicals.
// A random "wildcard" adds one or two surprise strengths or weaknesses.
// ─────────────────────────────────────────────────────────────────────────────

// Style → pillar weights (0-100 scale; applied as +/- from base roll)
const STYLE_BIAS = {
  'Striker':         { boxing:18, kicking:10, clinch_str:6, ground_str:2,
                       takedowns:-22, td_def:2, submissions:-14, sub_def:0,
                       clinch_grap:2, ground_ctrl:-8,
                       strength:4, hand_speed:10, move_speed:6, reaction:8,
                       cardio:2, recovery:-2, chin:6, body_tough:2, leg_dur:0, inj_res:0,
                       fight_iq:4, decision:4, composure:6, aggression:4, adaptive:2,
                       boxing_power:0, kicking_power:0, boxing_counters:2 },

  'Wrestler':        { boxing:-4, kicking:-8, clinch_str:6, ground_str:4,
                       takedowns:18, td_def:12, submissions:4, sub_def:6,
                       clinch_grap:14, ground_ctrl:14,
                       strength:14, hand_speed:-4, move_speed:4, reaction:2,
                       cardio:8, recovery:4, chin:6, body_tough:8, leg_dur:4, inj_res:4,
                       fight_iq:4, decision:6, composure:6, aggression:6, adaptive:4 ,
                       boxing_power:0, kicking_power:0, boxing_counters:-4 },

  'BJJ Artist':      { boxing:-8, kicking:-12, clinch_str:2, ground_str:8,
                       takedowns:6, td_def:4, submissions:20, sub_def:16,
                       clinch_grap:8, ground_ctrl:16,
                       strength:4, hand_speed:-2, move_speed:2, reaction:4,
                       cardio:4, recovery:6, chin:2, body_tough:2, leg_dur:2, inj_res:2,
                       fight_iq:10, decision:8, composure:14, aggression:-4, adaptive:8 ,
                       boxing_power:0, kicking_power:0, boxing_counters:-2 },

  'Muay Thai':       { boxing:10, kicking:16, clinch_str:18, ground_str:2,
                       takedowns:-14, td_def:2, submissions:-10, sub_def:-4,
                       clinch_grap:6, ground_ctrl:-4,
                       strength:6, hand_speed:6, move_speed:4, reaction:6,
                       cardio:10, recovery:4, chin:8, body_tough:12, leg_dur:10, inj_res:4,
                       fight_iq:6, decision:4, composure:8, aggression:10, adaptive:4 ,
                       boxing_power:0, kicking_power:0, boxing_counters:4 },

  'Kickboxer':       { boxing:12, kicking:18, clinch_str:4, ground_str:0,
                       takedowns:-22, td_def:-6, submissions:-18, sub_def:-10,
                       clinch_grap:-4, ground_ctrl:-10,
                       strength:4, hand_speed:14, move_speed:14, reaction:12,
                       cardio:4, recovery:2, chin:2, body_tough:2, leg_dur:4, inj_res:0,
                       fight_iq:6, decision:6, composure:4, aggression:6, adaptive:6 ,
                       boxing_power:0, kicking_power:0, boxing_counters:6 },

  'All-Rounder':     { boxing:2, kicking:2, clinch_str:2, ground_str:2,
                       takedowns:-2, td_def:2, submissions:0, sub_def:2,
                       clinch_grap:2, ground_ctrl:2,
                       strength:2, hand_speed:2, move_speed:2, reaction:2,
                       cardio:2, recovery:2, chin:2, body_tough:2, leg_dur:2, inj_res:2,
                       fight_iq:6, decision:6, composure:4, aggression:2, adaptive:10 ,
                       boxing_power:0, kicking_power:0, boxing_counters:4 },

  'Pressure Fighter':{ boxing:6, kicking:2, clinch_str:12, ground_str:6,
                       takedowns:8, td_def:6, submissions:2, sub_def:4,
                       clinch_grap:10, ground_ctrl:8,
                       strength:10, hand_speed:0, move_speed:-4, reaction:2,
                       cardio:16, recovery:8, chin:12, body_tough:14, leg_dur:6, inj_res:6,
                       fight_iq:6, decision:4, composure:8, aggression:16, adaptive:2 ,
                       boxing_power:0, kicking_power:0, boxing_counters:-2 },

  'Counter-Striker': { boxing:12, kicking:8, clinch_str:0, ground_str:2,
                       takedowns:-16, td_def:4, submissions:-8, sub_def:0,
                       clinch_grap:-2, ground_ctrl:-4,
                       strength:-2, hand_speed:12, move_speed:10, reaction:18,
                       cardio:2, recovery:2, chin:4, body_tough:2, leg_dur:2, inj_res:2,
                       fight_iq:14, decision:12, composure:12, aggression:-8, adaptive:12,
                       boxing_power:0, kicking_power:0, boxing_counters:22 },

  'Brawler':         { boxing:14, kicking:6, clinch_str:8, ground_str:4,
                       takedowns:-18, td_def:0, submissions:-10, sub_def:-2,
                       clinch_grap:2, ground_ctrl:-6,
                       strength:16, hand_speed:4, move_speed:2, reaction:4,
                       cardio:4, recovery:2, chin:14, body_tough:8, leg_dur:4, inj_res:4,
                       fight_iq:-4, decision:2, composure:-4, aggression:18, adaptive:-2,
                       boxing_power:18, kicking_power:6, boxing_counters:-8 },
};

// Division physicals modifier — heavier = more power/chin/strength, lighter = more speed/cardio
const DIV_PHYS = [
  // HW   LHW   MW   WW   LW   FW  BW   FLY
  {strength:[14,10,6,2,-2,-4,-8,-12],
   hand_speed:[-10,-6,-2,2,5,7,10,14],
   move_speed:[-10,-6,-2,2,5,7,10,14],
   reaction:[-6,-4,-2,0,3,5,7,10],
   cardio:[-10,-6,-2,2,5,7,10,13],
   recovery:[-6,-4,-2,0,3,5,7,8],
   chin:[12,8,4,0,-2,-4,-6,-8],
   body_tough:[10,6,3,0,-2,-4,-6,-8],
   leg_dur:[8,5,2,0,-1,-2,-4,-6],
  }
];

function genStats(style, divIdx){
  const bias = STYLE_BIAS[style] || STYLE_BIAS['All-Rounder'];
  const dp = DIV_PHYS[0];
  // Base roll: 48–82 range gives realistic spread
  function b(biasKey, physKey){
    const bv = bias[biasKey]||0;
    const dv = physKey ? (dp[physKey]?.[divIdx]||0) : 0;
    // Add individual noise so sub-stats within a group vary
    const noise = rnd(-8,8);
    return clamp(rnd(48,78) + bv + dv + noise, 28, 99);
  }
  // Wildcard: randomly boost or tank 1-3 stats
  const allKeys = ['boxing','kicking','clinch_str','ground_str','takedowns','td_def',
    'submissions','sub_def','clinch_grap','ground_ctrl','strength','hand_speed',
    'move_speed','reaction','cardio','recovery','chin','body_tough','leg_dur','inj_res',
    'fight_iq','decision','composure','aggression','adaptive',
    'boxing_power','kicking_power','boxing_counters'];
  const wildcardBoost = {};
  const numBoosts = rnd(1,3);
  for(let i=0;i<numBoosts;i++){
    const k = pick(allKeys); wildcardBoost[k] = (wildcardBoost[k]||0) + rnd(8,18);
  }
  const numWeaks = rnd(0,2);
  for(let i=0;i<numWeaks;i++){
    const k = pick(allKeys); wildcardBoost[k] = (wildcardBoost[k]||0) - rnd(8,16);
  }
  function s(bk, pk){ return clamp(b(bk,pk) + (wildcardBoost[bk]||0), 28, 99); }
  return {
    // GRAPPLING
    grap: {
      td: {
        sl_td:b('takedowns',null), cage_sl_td:b('takedowns',null), dl_td:b('takedowns',null),
        cage_dl_td:b('takedowns',null), ub_td:b('takedowns',null), blast_dl:b('takedowns',null),
      },
      td_def: {
        sl_def:b('td_def',null), cage_sl_def:b('td_def',null), dl_def:b('td_def',null),
        cage_dl_def:b('td_def',null), ub_def:b('td_def',null), blast_def:b('td_def',null),
      },
      sub_off: { chokes:s('submissions',null), joint_locks:s('submissions',null), leg_locks:s('submissions',null) },
      sub_def: { choke_def:s('sub_def',null), joint_def:s('sub_def',null), leg_def:s('sub_def',null) },
      clinch: { control:s('clinch_grap',null), transitions:s('clinch_grap',null),
                dirty_boxing:s('clinch_str',null), clinch_td:s('clinch_grap',null) },
      ground: {
        top_ctrl:s('ground_ctrl',null), bottom_ctrl:s('ground_ctrl',null), scrambling:s('ground_ctrl',null),
        wrestling_getup:s('ground_ctrl',null), bjj_getup:s('ground_ctrl',null),
        wrestling_trans:s('ground_ctrl',null), bjj_trans:s('ground_ctrl',null),
      },
    },
    // STRIKING
    str: {
      boxing: { jab:s('boxing',null), cross:s('boxing',null), hooks:s('boxing',null),
                uppercuts:s('boxing',null), overhands:s('boxing',null),
                head_mov:s('boxing',null), blocking:s('boxing',null),
                power:s('boxing_power',null), counters:s('boxing_counters',null) },
      kicking: { low_kicks:s('kicking',null), body_kicks:s('kicking',null),
                 teep:s('kicking',null), kick_def:s('kicking',null),
                 power:s('kicking_power',null) },
      clinch_str: { knees:s('clinch_str',null), elbows:s('clinch_str',null), clinch_str_def:s('clinch_str',null) },
      ground_str: { gnd_strikes:s('ground_str',null), gnd_def:s('ground_str',null), gnd_elbows:s('ground_str',null) },
    },
    // PHYSICALS
    phys: {
      strength:    s('strength','strength'),
      hand_speed:  s('hand_speed','hand_speed'),
      move_speed:  s('move_speed','move_speed'),
      reaction:    s('reaction','reaction'),
      cardio:      s('cardio','cardio'),
      recovery:    s('recovery','recovery'),
      chin:        s('chin','chin'),
      body_tough:  s('body_tough','body_tough'),
      leg_dur:     s('leg_dur','leg_dur'),
      inj_res:     s('inj_res','inj_res'),
    },
    // MENTAL
    ment: {
      fight_iq:   s('fight_iq',null),
      decision:   s('decision',null),
      composure:  s('composure',null),
      aggression: s('aggression',null),
      adaptive:   s('adaptive',null),
    },
  };
}

// Compute pillar averages and overall rating from full stat tree
function computeRating(stats){
  const grap = stats.grap;
  const str  = stats.str;
  const phys = stats.phys;
  const ment = stats.ment;
  function avg(...vals){ return vals.reduce((a,b)=>a+b,0)/vals.length; }
  const tdAvg   = avg(...Object.values(grap.td));
  const tdDefAvg= avg(...Object.values(grap.td_def));
  const subOffAvg= avg(...Object.values(grap.sub_off));
  const subDefAvg= avg(...Object.values(grap.sub_def));
  const clinchGrAvg= avg(...Object.values(grap.clinch));
  const gndAvg  = avg(...Object.values(grap.ground));
  const boxAvg  = avg(...Object.values(str.boxing));
  const kickAvg = avg(...Object.values(str.kicking));
  const clinchStrAvg= avg(...Object.values(str.clinch_str));
  const gndStrAvg= avg(...Object.values(str.ground_str));
  const physAvg = avg(...Object.values(phys));
  const mentAvg = avg(...Object.values(ment));
  // Weighted: grappling 25%, striking 25%, physicals 30%, mental 20%
  const grapScore = avg(tdAvg, tdDefAvg, subOffAvg, subDefAvg, clinchGrAvg, gndAvg);
  const strScore  = avg(boxAvg, kickAvg, clinchStrAvg, gndStrAvg);
  return Math.round(grapScore*0.25 + strScore*0.25 + physAvg*0.30 + mentAvg*0.20);
}

function getPillarScores(f){
  if(!f.stats) return {grappling:f.wrestling||60, striking:f.striking||60, physicals:f.cardio||60, mental:70};
  const s = f.stats;
  function avg(...vals){ return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length); }
  return {
    grappling: avg(
      avg(...Object.values(s.grap.td)), avg(...Object.values(s.grap.td_def)),
      avg(...Object.values(s.grap.sub_off)), avg(...Object.values(s.grap.sub_def)),
      avg(...Object.values(s.grap.clinch)), avg(...Object.values(s.grap.ground))
    ),
    striking: avg(
      avg(...Object.values(s.str.boxing)), avg(...Object.values(s.str.kicking)),
      avg(...Object.values(s.str.clinch_str)), avg(...Object.values(s.str.ground_str))
    ),
    physicals: avg(...Object.values(s.phys)),
    mental: avg(...Object.values(s.ment)),
  };
}

// Height ranges per division (inches) and reach multiplier (typically 1.00-1.05 of height)
const DIV_HEIGHT = [
  [74,80],[72,77],[70,75],[68,73],[66,71],[64,69],[62,67],[60,65]
]; // HW,LHW,MW,WW,LW,FW,BW,FLY

function genFighter(isPlayer=false, rank=null, forceDivision=null, forceNat=null){
  const div = forceDivision || pick(DIVISIONS);
  const idx = DIVISIONS.indexOf(div);
  const col = COLORS[idx];
  const nat = forceNat || pickNat();
  const names = pickName(nat);
  const style = pick(STYLES);
  const stance = Math.random()<0.78 ? 'Orthodox' : 'Southpaw';
  const rawNickname = Math.random()<0.40 ? pick(NICKNAMES.filter(n=>n)) : null;
  const nickname = rawNickname ? '"'+rawNickname+'"' : null;

  let wins, losses;
  const rankNum = rank || rnd(1,15);
  if(isPlayer){
    wins=rnd(3,10); losses=rnd(0,3);
  } else if(rankNum===1){
    // Champion / #1: elite records, very few losses, lots of fights
    wins=rnd(18,28); losses=rnd(0,2);
  } else if(rankNum<=3){
    // Top 3 contenders: dominant records
    wins=rnd(14,22); losses=rnd(0,3);
    if(wins<=losses*3) wins=losses*3+rnd(4,8); // ensure strong positive ratio
  } else if(rankNum<=7){
    // Rank 4-7: solid records with experience
    wins=rnd(10,18); losses=rnd(2,5);
    if(wins<=losses+3){ wins=losses+rnd(4,7); }
  } else if(rankNum<=12){
    // Rank 8-12: decent records
    wins=rnd(7,14); losses=rnd(2,6);
    if(wins<losses+2){ wins=losses+rnd(2,4); }
  } else {
    // Unranked: active but not dominant
    const total=rnd(5,14);
    losses=rnd(1, Math.floor(total*0.45));
    wins=total-losses;
    if(wins<losses){ wins=losses+rnd(1,2); }
  }
  wins=Math.max(1,wins); losses=Math.max(0,losses);
  if(!isPlayer && wins<=losses){ wins=losses+1; }
  // Hard floor for elite slots — no matter what, top ranks must look the part
  if(!isPlayer){
    if(rankNum===1){
      wins=Math.max(wins, 18); losses=Math.min(losses, 2);
    } else if(rankNum<=3){
      wins=Math.max(wins, 13); losses=Math.min(losses, 4);
    } else if(rankNum<=7){
      wins=Math.max(wins, 9); losses=Math.min(losses, 6);
    } else if(rankNum<=10){
      wins=Math.max(wins, 6); losses=Math.min(losses, 7);
    }
  }

  const stats = genStats(style, idx);
  // Height and reach generation
  const [hMin,hMax] = DIV_HEIGHT[idx] || [66,72];
  const heightIn = rnd(hMin, hMax);
  // Reach typically 0.97–1.05× height; taller fighters skew toward longer reach
  const reachMultBase = 0.97 + Math.random()*0.08;
  const reachIn = Math.round(heightIn * reachMultBase);

  const f = {
    id: Math.random().toString(36).slice(2),
    first: names.first, last: names.last, nickname, stance,
    division: div, divIdx: idx, style, color: col,
    initials: names.first[0]+names.last[0],
    nationality: nat,
    wins, losses,
    age: rnd(21,37),
    rank: rankNum,
    height: heightIn,   // inches
    reach:  reachIn,    // inches
    condition: 100, stamina: 100,
    morale: rnd(60,100),
    contract: rnd(1,4),
    salary: rnd(4000,35000),
    training: null,
    stats,
    experience: rnd(20,100),
    fightHistory: [],
  };
  f.name = f.first+' '+f.last;

  // ── Preset finish rates based on archetype and wins ──────────────────────
  // Each style has a base KO%, Sub%, Dec% split (must sum to ~1.0)
  // These represent the "typical" finishing pattern for that archetype
  const STYLE_FINISH_BIAS = {
    'Brawler':         { ko:0.52, sub:0.05, dec:0.43 },
    'Striker':         { ko:0.38, sub:0.06, dec:0.56 },
    'Kickboxer':       { ko:0.32, sub:0.06, dec:0.62 },
    'Muay Thai':       { ko:0.30, sub:0.10, dec:0.60 },
    'Pressure Fighter':{ ko:0.25, sub:0.12, dec:0.63 },
    'Counter-Striker': { ko:0.28, sub:0.05, dec:0.67 },
    'Wrestler':        { ko:0.15, sub:0.22, dec:0.63 },
    'BJJ Artist':      { ko:0.08, sub:0.55, dec:0.37 },
    'All-Rounder':     { ko:0.22, sub:0.18, dec:0.60 },
  };
  const finBias = STYLE_FINISH_BIAS[style] || STYLE_FINISH_BIAS['All-Rounder'];
  // Division modifier: heavier weights hit harder, lighter weights more technical
  // idx: 0=HW, 1=LHW, 2=MW, 3=WW, 4=LW, 5=FW, 6=BW, 7=FLY
  const DIV_KO_BONUS  = [0.20, 0.13, 0.07, 0.03, 0,    0,    -0.03, -0.05];
  const DIV_SUB_BONUS = [0,    0,    0.02, 0.03, 0.04, 0.05,  0.05,  0.04];
  const divKoBonus  = DIV_KO_BONUS[idx]  || 0;
  const divSubBonus = DIV_SUB_BONUS[idx] || 0;
  // Add noise so fighters of the same archetype differ slightly
  const koRate  = clamp(finBias.ko  + divKoBonus  + (Math.random()-0.5)*0.12, 0.02, 0.85);
  const subRate = clamp(finBias.sub + divSubBonus + (Math.random()-0.5)*0.10, 0.02, 0.80);
  const decRate = Math.max(0.05, 1 - koRate - subRate);
  // Distribute wins among finish types
  const koW  = Math.round(wins * koRate);
  const subW = Math.round(wins * subRate);
  const decW = Math.max(0, wins - koW - subW);
  f.koWins  = koW;
  f.subWins = subW;
  f.decWins = decW;

  // ── Starting popularity based on rank, finish rate, and record ────────────
  // Higher-ranked fighters and finishers start more popular
  const finRate = (koW+subW) / Math.max(wins,1);
  // Rank bonus: #1 = +50, #2 = +45 ... scales down to 0 at rank 10+
  const rankBonus  = clamp(Math.max(0, 10 - (rankNum||10)) * 6, 0, 50);
  // Finish bonus: pure finisher (100%) = +40, pure decision (0%) = 0
  const finBonus   = Math.round(finRate * 40);
  // Record bonus: wins contribute more than losses penalise
  const recBonus   = clamp(wins * 3 - losses * 2, 0, 30);
  // Decision fighters lose a little — but cap the penalty
  const decPenalty = Math.round((1 - finRate) * 6);
  // Base floor: even unknown fighters have some floor popularity
  const basePop = rnd(15, 30);
  f.popularity = clamp(basePop + rankBonus + finBonus + recBonus - decPenalty + rnd(0,10), 0, 95);
  f.rating = computeRating(stats);
  // Legacy flat props (used by fight engine + cards)
  const p = getPillarScores(f);
  f.striking  = p.striking;
  f.wrestling = p.grappling;
  f.bjj       = Math.round(avg2(f.stats.grap.sub_off.chokes, f.stats.grap.sub_off.joint_locks, f.stats.grap.sub_off.leg_locks));
  f.chin      = f.stats.phys.chin;
  f.cardio    = f.stats.phys.cardio;
  f.speed     = Math.round(avg2(f.stats.phys.hand_speed, f.stats.phys.move_speed));
  f.power     = f.stats.phys.strength;
  return f;
}
function avg2(...vals){ return vals.reduce((a,b)=>a+b,0)/vals.length; }

// ── Prospect generation ──────────────────────────────────────────────────────
function genProspect(forceDivision=null){
  const div = forceDivision || pick(DIVISIONS);
  const totalFights = rnd(3, 12);
  const minWins = Math.ceil(totalFights * 0.75);
  const wins = rnd(minWins, totalFights);
  const losses = totalFights - wins;
  const f = genFighter(false, rnd(8,15), div);
  f.wins = wins;
  f.losses = losses;
  f.isProspect = true;
  f.scoutedWeek = G.week;
  // Prospects are slightly younger and have lower experience
  f.age = rnd(19, 27);
  f.experience = rnd(10, 50);
  // Potential rating (hidden ceiling they can grow to)
  f.potential = clamp(f.rating + rnd(5, 20), 50, 99);
  // Hype tier based on record and rating
  const ratio = wins / (losses || 1);
  if(ratio >= 6 && f.rating >= 72) f.hype = 'elite';
  else if(ratio >= 4 || f.rating >= 68) f.hype = 'high';
  else f.hype = 'medium';
  return f;
}

function refreshProspects(){
  G.prospects = [];
  DIVISIONS.forEach(d=>{
    const count = rnd(1,3);
    for(let i=0;i<count;i++) G.prospects.push(genProspect(d));
  });
  renderProspects();
  showToast('New prospects scouted!');
}

// ── Auto-cut logic ────────────────────────────────────────────────────────────
function checkAutoCuts(){
  const flagged = [];
  G.roster.forEach(f=>{
    const total = f.wins + f.losses;
    if(total < 2) return; // too few fights to judge
    const ratio = f.wins / (f.losses || 1);
    const consec = G.consecutiveLosses[f.id] || 0;
    const reasons = [];
    if(ratio < 0.5 && total >= 4) reasons.push(`W/L ratio ${f.wins}-${f.losses} (below 0.5 threshold)`);
    if(consec >= 5) reasons.push(`${consec} consecutive losses`);
    if(reasons.length > 0) flagged.push({fighter: f, reasons});
  });
  return flagged;
}

function executeAutoCuts(){
  G.autoCutPending.forEach(({fighter:f})=>{
    const idx = G.roster.findIndex(r=>r.id===f.id);
    if(idx!==-1){
      G.roster.splice(idx,1);
      G.freeAgents.push(f);
      addNews(`${f.name} has been released from the roster (${f.wins}-${f.losses}).`, G.week);
    }
  });
  G.autoCutPending = [];
  closeModal('autocut-modal');
  renderAll();
  showToast('Roster cuts complete.');
}

// ── Promote a signed fighter into the world pool ─────────────────────────────
// They stay on your roster but are also added to G.opponents so they show up
// in the organisation tab, card generation, and fight options near their rank.
function promoteFighterToPool(id){
  closeModal('fighter-profile-modal');
  const f = G.roster.find(x=>x.id===id);
  if(!f){ showToast('Fighter not found.'); return; }
  // 4-week cooldown per fighter
  const lastPromo = f._lastPromoWeek || 0;
  const cooldown = 4;
  const weeksLeft = cooldown - (G.week - lastPromo);
  if(lastPromo > 0 && weeksLeft > 0){
    showToast(`${f.first} was just promoted — ${weeksLeft} week${weeksLeft>1?'s':''} until next campaign.`);
    return;
  }
  const cost = 5000;
  if(G.money < cost){ showToast(`Not enough funds — promotion costs ${fmtMoney(cost)}.`); return; }
  G.money -= cost;
  f._lastPromoWeek = G.week;
  const boost = rnd(8, 18);
  f.popularity = clamp((f.popularity||0) + boost, 0, 100);
  addNews(`${f.name} popularity boosted to ${f.popularity} after promotional campaign.`, G.week);
  showToast(`${f.first} promoted! +${boost} popularity (now ${f.popularity})`);
  renderAll();
}

function confirmCut(id){
  const f = G.roster.find(x=>x.id===id);
  if(!f) return;
  if(confirm('Release ' + f.name + '?')) manualCut(id);
}
function confirmCutAndClose(id){
  const f = G.roster.find(x=>x.id===id);
  if(!f) return;
  if(confirm('Release ' + f.name + '?')){ closeModal('fighter-profile-modal'); manualCut(id); }
}
function manualCut(id){
  const idx = G.roster.findIndex(f=>f.id===id);
  if(idx===-1) return;
  const f = G.roster[idx];
  G.roster.splice(idx,1);
  G.freeAgents.push(f);
  delete G.consecutiveLosses[f.id];
  addNews(`${f.name} has been released.`, G.week);
  showToast(f.name+' released.');
  renderAll();
}

function showAutoCutModal(flagged){
  G.autoCutPending = flagged;
  const list = document.getElementById('autocut-list');
  list.innerHTML = flagged.map(({fighter:f, reasons})=>`
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid #5A1A00;border-radius:3px;background:#150800;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:13px;flex-shrink:0">${f.initials}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${f.name} <span style="color:var(--muted);font-size:11px">${f.division}</span></div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Record: ${f.wins}W-${f.losses}L · Rating: ${f.rating}</div>
        ${reasons.map(r=>`<div style="font-size:11px;color:var(--red-bright);margin-top:3px">⚠ ${r}</div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="G.autoCutPending=G.autoCutPending.filter(x=>x.fighter.id!=='${f.id}');this.closest('div[style]').remove()">Keep</button>
    </div>`).join('');
  openModal('autocut-modal');
}

const EVENT_NAMES = ['Fight Night','Showdown','Clash','Warfare','Battle Series','Championship Series','Grand Prix','Invictus'];

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-CARD GENERATION & FIGHT OFFER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

function getFighterWorldRank(fighterId, div){
  const ranked = getRankableFighters(div);
  const idx = ranked.findIndex(f=>f.id===fighterId);
  return idx>=0 ? idx+1 : null;
}

function isBooked(fighterId){
  return G.schedule.some(e=>
    (e.fights||[]).some(fi=>
      (fi.fighterId===fighterId||fi.opponentId===fighterId) && !fi.result
    )
  );
}

// ── POPULARITY SYSTEM ──────────────────────────────────────────────────────
// Popularity 0-100. Displayed in profile. Affects fight offer opportunities.
function computePopularity(f){
  const wins   = f.wins || 0;
  const losses = f.losses || 0;
  const total  = wins + losses;
  if(total === 0) return f.popularity || 10;

  const koFinishes  = (f.koWins||0) + (f.subWins||0);
  const finishRate  = koFinishes / Math.max(wins, 1); // 0-1
  const decRate     = 1 - finishRate;

  // Base: rank score (top ranked = high base)
  const rankScore = clamp((f._rankScore||0) * 0.5, 0, 40);

  // Finish bonus: finishers are crowd favourites
  const finishBonus = finishRate * 35;

  // Decision penalty: decision fighters are less exciting
  const decPenalty  = decRate * 10;

  // Win/loss ratio contribution
  const recordBonus = clamp(wins * 1.5 - losses * 2, 0, 20);

  // Clamp result
  return Math.round(clamp(rankScore + finishBonus - decPenalty + recordBonus, 0, 100));
}

// Apply a popularity event (dominant win, finish, upset win)
function applyPopularityEvent(f, type){
  if(!f) return;
  const current = f.popularity || 0;
  let delta = 0;
  if(type==='finish_ko')    delta = rnd(6,12);
  else if(type==='finish_sub') delta = rnd(5,10);
  else if(type==='dominant')   delta = rnd(3,6);
  else if(type==='decision')   delta = rnd(0,2);
  else if(type==='loss')       delta = -rnd(2,5);
  else if(type==='loss_ko')    delta = -rnd(4,8);
  f.popularity = clamp(current + delta, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART CARD MATCHMAKING
// Rules:
//   • Title fights: champion vs #1 contender
//   • Main events: top 4 ranked vs each other, prefer fighters who haven't met recently
//   • Co-mains / upper card: rank 3-6, ideally someone coming off a loss fighting
//     a lower-ranked opponent, or two fighters with no prior meeting
//   • Undercard: unranked or rank 7-8, prefer fresh matchups
//   • Never rebook a fight that happened in the last 8 weeks
// ─────────────────────────────────────────────────────────────────────────────

function recentlyFought(a, b, weeksBack=8){
  // Check if a and b fought each other in the last weeksBack weeks
  return (a.fightHistory||[]).some(h=>
    h.opponentId===b.id && (G.week - h.week) <= weeksBack
  );
}

function fightRecord(a, b){
  // Returns 'aWon', 'bWon', or null if never fought
  const h = (a.fightHistory||[]).find(x=>x.opponentId===b.id);
  if(!h) return null;
  return h.result==='W' ? 'aWon' : 'bWon';
}

function pickSmartOpponent(f1, candidates, usedIds, weeksBack=8){
  // Priority: (1) never fought, (2) f1 lost to them recently (redemption), (3) haven't fought in a while
  const available = candidates.filter(c=>c.id!==f1.id && !usedIds.has(c.id) && !isBooked(c.id));
  if(available.length===0) return null;

  // Never-met first — prefer higher popularity as a tiebreak
  const neverMet = available.filter(c=>!recentlyFought(f1,c,weeksBack) && fightRecord(f1,c)===null);
  if(neverMet.length>0){
    // Among never-met, boost chance of picking high-popularity fighters
    const weighted = [];
    neverMet.forEach(c=>{ const pops = Math.max(1, Math.round((c.popularity||20)/20)); for(let i=0;i<pops;i++) weighted.push(c); });
    return pick(weighted);
  }

  // Didn't fight recently (but fought before)
  const notRecent = available.filter(c=>!recentlyFought(f1,c,weeksBack));
  if(notRecent.length>0) return pick(notRecent);

  // Fallback: whoever is available
  return pick(available);
}

function autoGenerateCard(evt){
  if(evt.cardGenerated) return;
  evt.cardGenerated = true;

  const allPool = [...new Map([...G.roster,...G.opponents].map(f=>[f.id,f])).values()];
  const usedIds = new Set();
  // Don't rebook fighters already on this card (player bookings)
  (evt.fights||[]).forEach(fi=>{ usedIds.add(fi.fighterId); usedIds.add(fi.opponentId); });

  // Divisions already covered by player bookings
  const usedDivs = new Set((evt.fights||[]).map(fi=>{
    const f = allPool.find(x=>x.id===fi.fighterId);
    return f?.division;
  }));
  const availDivs = [...DIVISIONS].filter(d=>!usedDivs.has(d)).sort(()=>Math.random()-0.5);

  function getRanked(div){ return getRankableFighters(div); }
  function getUnranked(div){
    const r10ids = new Set(getRanked(div).map(f=>f.id));
    return allPool.filter(f=>f.division===div && f.wins>f.losses && !r10ids.has(f.id) && !usedIds.has(f.id) && !isBooked(f.id));
  }

  function bookFight(f1, f2, slot, isMain, isTitle, div){
    // slot values: 'title' | 'main_event' | 'co_main' | 'undercard'
    const purse = isTitle ? rnd(80000,200000) : isMain ? rnd(30000,80000)
                : slot==='co_main' ? rnd(15000,35000) : rnd(6000,18000);
    if((evt.fights||[]).length >= 6) return; // hard cap at 6 fights
    evt.fights.push({
      id:'f_'+Math.random().toString(36).slice(2),
      fighterId:f1.id, opponentId:f2.id,
      purse, result:null,
      isMainEvent: isMain && !isTitle,
      isTitleFight: isTitle,
      slot, division:div||f1.division
    });
    usedIds.add(f1.id); usedIds.add(f2.id);
  }

  // Hard cap: card always has exactly 6 fights total
  // Detect the player's slot to avoid duplicating it
  const existingFights = evt.fights || [];
  const playerFight = existingFights.find(fi => fi.playerBooked);
  const playerSlot  = playerFight ? (playerFight.isTitleFight ? 'title' : playerFight.isMainEvent ? 'main_event' : playerFight.slot || 'undercard') : null;

  // Decide how many main-card vs undercard slots to fill
  // Standard card: 1 main event + 2 co-mains + 3 undercards = 6
  // If player occupies a main-card slot, we still fill to 6 total
  const needMainEvent = playerSlot !== 'main_event' && playerSlot !== 'title';
  const needCoMains   = playerSlot === 'co_main' ? 1 : 2; // player takes one co-main slot if applicable
  const filledMainSlots = existingFights.filter(fi => fi.slot === 'main_event' || fi.slot === 'title' || fi.slot === 'co_main').length;
  const filledUnderSlots = existingFights.filter(fi => fi.slot === 'undercard').length;

  // How many of each type to auto-generate
  const wantMainCard  = Math.max(0, (needMainEvent ? 1 : 0) + needCoMains - filledMainSlots);
  const wantUndercard = Math.max(0, 3 - filledUnderSlots);
  const totalNeeded   = wantMainCard + wantUndercard;

  const mainDivs      = availDivs.slice(0, Math.min(wantMainCard, availDivs.length));
  const undercardDivs = availDivs.slice(mainDivs.length, mainDivs.length + Math.min(wantUndercard, availDivs.length - mainDivs.length));

  // ── MAIN CARD bouts ───────────────────────────────────────────────────────
  // mainEventPlaced tracks whether the headliner has been generated yet
  let mainEventPlaced = !needMainEvent; // if player IS the main event, skip generating one
  mainDivs.forEach((div)=>{
    if((evt.fights||[]).length >= 6) return;
    const isTitle = evt.type==='title' && !mainEventPlaced;
    const ranked  = getRanked(div);
    const avail   = ranked.filter(f=>!usedIds.has(f.id)&&!isBooked(f.id));
    if(avail.length < 2) return;

    if(isTitle){
      const champ = avail[0];
      const contender = avail.find(f=>f.id!==champ.id) || null;
      if(!contender) return;
      bookFight(champ, contender, 'title', true, true, div);
      mainEventPlaced = true;
      return;
    }

    if(!mainEventPlaced){
      // Generate main event headliner
      const top4 = avail.slice(0,4);
      const f1 = top4[0];
      const f2 = pickSmartOpponent(f1, top4.slice(1), usedIds);
      if(!f1||!f2) return;
      bookFight(f1, f2, 'main_event', true, false, div);
      mainEventPlaced = true;
    } else {
      // Co-main bout
      const mid = avail.slice(2,7);
      if(mid.length<2) return;
      const onLoss = mid.find(f=>(G.consecutiveLosses[f.id]||0)>=1);
      const f1 = onLoss || pick(mid);
      const lowerRanked = avail.filter(f=>f.id!==f1.id && avail.indexOf(f)>avail.indexOf(f1));
      const f2 = pickSmartOpponent(f1, lowerRanked.length>0?lowerRanked:mid.filter(f=>f.id!==f1.id), usedIds);
      if(!f1||!f2) return;
      bookFight(f1, f2, 'co_main', false, false, div);
    }
  });

  // ── UNDERCARD (3 bouts) ────────────────────────────────────────────────────
  undercardDivs.forEach(div=>{
    const ranked  = getRanked(div);
    const avail   = ranked.filter(f=>!usedIds.has(f.id)&&!isBooked(f.id));
    const unranked = getUnranked(div);

    // Prefer unranked vs unranked; fallback to low-ranked vs unranked
    if(unranked.length>=2){
      const f1 = pick(unranked);
      usedIds.add(f1.id);
      const f2 = pickSmartOpponent(f1, unranked, usedIds, 12);
      if(!f2){ usedIds.delete(f1.id); return; }
      bookFight(f1, f2, 'undercard', false, false, div);
    } else if(avail.length>=1 && unranked.length>=1){
      // Low-ranked vs unranked step-up fight
      const f1 = avail[avail.length-1]; // lowest ranked
      const f2 = pick(unranked.filter(u=>u.id!==f1.id));
      if(!f2) return;
      bookFight(f1, f2, 'undercard', false, false, div);
    } else if(avail.length>=2){
      // All ranked — use bottom of the card
      const f1 = avail[avail.length-2];
      const f2 = avail[avail.length-1];
      bookFight(f1, f2, 'undercard', false, false, div);
    }
  });

  addNews('Card set for '+evt.name+' (Wk '+evt.week+'): '+evt.fights.length+' bouts.', G.week);
}

function buildFightOffer(evt){
  if(evt.offerSent) return;
  evt.offerSent = true;

  const freeRoster = G.roster.filter(f=>!isBooked(f.id));
  if(freeRoster.length===0) return;

  const yourFighter = pick(freeRoster);
  const div = yourFighter.division;
  const yourRank = getFighterWorldRank(yourFighter.id, div);
  const allOpps = G.opponents.filter(f=>f.division===div&&!isBooked(f.id)&&f.id!==yourFighter.id);
  if(allOpps.length===0) return;

  let opponent;
  const ranked = getRankableFighters(div).filter(f=>!isBooked(f.id)&&f.id!==yourFighter.id);
  if(yourRank && yourRank<=5 && ranked.length>0){
    opponent = pick(ranked.slice(0, Math.min(ranked.length, 4)));
  } else if(ranked.length>0 && Math.random()<0.35){
    opponent = pick(ranked);
  } else {
    const unranked = allOpps.filter(f=>!(f.wins>f.losses));
    opponent = unranked.length>0 ? pick(unranked) : pick(allOpps);
  }
  if(!opponent) return;

  const isMain = !!(yourRank && yourRank<=5);
  const basePurse = isMain ? rnd(25000,80000) : rnd(8000,28000);
  G.pendingOffer = {evt, yourFighter, opponent, purse:basePurse, isMain};
  showFightOfferModal();
}

function showFightOfferModal(){
  const offer = G.pendingOffer;
  if(!offer) return;
  const {evt,yourFighter:f,opponent:o,purse,isMain} = offer;
  const yourRank = getFighterWorldRank(f.id,f.division);
  const oppRank  = getFighterWorldRank(o.id,o.division);
  const wc = clamp(Math.round(50+(f.rating-o.rating)*0.8+(f.condition-80)*0.2),15,85);

  const badge = document.getElementById('fight-offer-event-badge');
  if(badge){
    badge.textContent = isMain?'MAIN CARD':'UNDERCARD';
    badge.style.cssText = 'font-size:10px;padding:3px 10px;border-radius:2px;font-family:Barlow Condensed,sans-serif;font-weight:700;letter-spacing:1px;'+(isMain?'background:#3A1A00;color:var(--gold);border:1px solid var(--gold-dim)':'background:var(--bg4);color:var(--muted);border:1px solid var(--border)');
  }
  const sub = document.getElementById('fight-offer-subtitle');
  if(sub) sub.textContent = evt.name+' · Week '+evt.week+(isMain?' · Main Card Bout':' · Undercard Bout');

  const cont = document.getElementById('fight-offer-content');
  if(cont) cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-bottom:16px;padding:16px;background:var(--bg3);border-radius:4px">
      <div style="text-align:center">
        <div style="width:48px;height:48px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:18px;margin:0 auto 6px">${f.initials}</div>
        <div style="font-family:'Bebas Neue';font-size:17px">${f.name}</div>
        <div style="font-size:11px;color:var(--gold)">${yourRank?'Ranked #'+yourRank:'Unranked'} · ${f.division}</div>
        <div style="font-size:11px;color:var(--muted)">${f.wins}-${f.losses} · Cond ${f.condition}%</div>
      </div>
      <div style="text-align:center">
        <div style="font-family:'Bebas Neue';font-size:30px;color:var(--red)">VS</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">YOUR WIN%</div>
        <div style="font-family:'Bebas Neue';font-size:22px;color:${wc>60?'var(--green)':wc>40?'var(--gold)':'var(--red-bright)'}">${wc}%</div>
      </div>
      <div style="text-align:center">
        <div style="width:48px;height:48px;border-radius:50%;background:${o.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:18px;margin:0 auto 6px">${o.initials}</div>
        <div style="font-family:'Bebas Neue';font-size:17px">${o.name}</div>
        <div style="font-size:11px;color:var(--muted)">${oppRank?'Ranked #'+oppRank:'Unranked'} · ${o.division}</div>
        <div style="font-size:11px;color:var(--muted)">${o.wins}-${o.losses}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1;background:var(--bg3);border-radius:3px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Purse</div>
        <div style="font-family:'Bebas Neue';font-size:22px;color:var(--gold)">${fmtMoney(purse)}</div>
      </div>
      <div style="flex:1;background:var(--bg3);border-radius:3px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Position</div>
        <div style="font-family:'Bebas Neue';font-size:22px;color:${isMain?'var(--gold)':'var(--text)'}">${isMain?'MAIN':'UNDERCARD'}</div>
      </div>
      <div style="flex:1;background:var(--bg3);border-radius:3px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Weeks Out</div>
        <div style="font-family:'Bebas Neue';font-size:22px">${evt.week-G.week}</div>
      </div>
    </div>`;

  const slider = document.getElementById('fight-offer-counter-slider');
  if(slider){ slider.max = purse*3; slider.value = purse; }
  const cv = document.getElementById('fight-offer-counter-val');
  if(cv) cv.textContent = fmtMoney(purse);
  const bud = document.getElementById('fight-offer-budget');
  if(bud) bud.textContent = fmtMoney(purse*2);
  const neg = document.getElementById('fight-offer-negotiate');
  if(neg) neg.style.display='none';

  const acts = document.getElementById('fight-offer-actions');
  if(acts) acts.innerHTML = `
    <button class="btn btn-gold" onclick="acceptFightOffer()">Accept</button>
    <button class="btn btn-ghost" onclick="toggleNegotiate()">Negotiate ↕</button>
    <button class="btn btn-red btn-sm" onclick="rejectFightOffer()">Reject</button>
    <button class="btn btn-ghost btn-sm" onclick="closeModal('fight-offer-modal')" style="margin-left:auto;font-size:10px">Later</button>`;

  openModal('fight-offer-modal');
}

function toggleNegotiate(){
  const el=document.getElementById('fight-offer-negotiate');
  if(el) el.style.display=el.style.display==='none'?'block':'none';
}

function acceptFightOffer(customPurse){
  const offer=G.pendingOffer; if(!offer) return;
  const finalPurse=customPurse||offer.purse;
  const {evt,yourFighter:f,opponent:o,isMain}=offer;
  if(!evt.fights) evt.fights=[];
  evt.fights.unshift({
    id:'f_'+Math.random().toString(36).slice(2),
    fighterId:f.id, opponentId:o.id,
    purse:finalPurse, result:null,
    isMainEvent:isMain, slot:isMain?'main_event':'undercard',
    division:f.division, playerBooked:true
  });
  addNews(f.name+' vs '+o.name+' booked for '+evt.name+' (Wk '+evt.week+') — '+fmtMoney(finalPurse),G.week);
  showToast(f.name+' booked for '+evt.name+'!');
  G.pendingOffer=null;
  closeModal('fight-offer-modal');
  renderAll();
}

function submitCounterOffer(){
  const slider=document.getElementById('fight-offer-counter-slider');
  if(!slider||!G.pendingOffer) return;
  const counter=parseInt(slider.value);
  const budget=G.pendingOffer.purse*2;
  const chance=counter<=G.pendingOffer.purse?0.95:counter<=budget?0.65:counter<=budget*1.5?0.3:0.1;
  if(Math.random()<chance){
    G.pendingOffer.purse=counter;
    showToast('Counter accepted at '+fmtMoney(counter)+'!');
    acceptFightOffer(counter);
  } else {
    showToast('Counter rejected — fight fell through.');
    addNews('Counter-offer rejected: '+G.pendingOffer.yourFighter.name+' vs '+G.pendingOffer.opponent.name+' cancelled.',G.week);
    G.pendingOffer=null;
    closeModal('fight-offer-modal');
    renderAll();
  }
}

function rejectFightOffer(){
  if(G.pendingOffer){
    addNews(G.pendingOffer.yourFighter.name+' turned down a fight on '+G.pendingOffer.evt.name+'.',G.week);
    showToast('Offer rejected.');
    G.pendingOffer=null;
  }
  closeModal('fight-offer-modal');
  renderAll();
}

function genSchedule(){
  G.schedule = [];
  let num = 1;
  for(let w=4; w<=52; w+=4){
    const isTitle  = w%16===0;
    const isMain   = !isTitle && w%8===0;
    const eName    = pick(EVENT_NAMES);
    G.schedule.push({
      id: 'evt_'+w,
      week: w,
      name: 'Iron Cage '+eName+' '+num,
      type: isTitle?'title':isMain?'main':'standard',
      fights: [],
      cardGenerated: false,
      offerSent: false,
    });
    num++;
  }
}

// Pre-populate the first N events with full auto-generated cards.
// Called after the world pool is seeded so fighters exist to book.
function genPremadeCards(count){
  const upcoming = G.schedule.filter(e=>!e.cardGenerated).slice(0,count);
  upcoming.forEach(evt=>{
    evt.offerSent = true;      // skip manager offer for premade cards
    autoGenerateCard(evt);
  });
}

// ===================== INIT =====================
function init(){
  // Player roster — one from each of 4 random divisions
  const playerDivs = [...DIVISIONS].sort(()=>Math.random()-0.5).slice(0,4);
  playerDivs.forEach(d=>{
    const pf = genFighter(true,null,d);
    G.roster.push(pf);
    G.opponents.push(pf); // player fighters visible in world rankings from day 1
  });

  // World pool: 10 ranked fighters + 18 unranked per division
  // Ranked: strong positive records, tiered by rank slot
  DIVISIONS.forEach(d=>{
    // 8 ranked — assign rank-appropriate records AND fixed rank scores so order is guaranteed
    // rankScore tiers ensure rank 1 > rank 2 > ... > rank 8 from day 1
    const RANK_SCORE_BASE = [220, 195, 172, 151, 132, 115, 100, 87, 75, 64];
    for(let i=0;i<10;i++){
      const f = genFighter(false, i+1, d);
      // Override rankScore with a tier-appropriate value + small noise
      f._rankScore = RANK_SCORE_BASE[i] + rnd(-8, 8);
      if(i===0){ f.isChamp = true; } // rank 1 is the champion
      G.opponents.push(f);
    }
    // 20 unranked — varied records, some decent some bad
    for(let i=0;i<18;i++){
      const f = genFighter(false, rnd(11,20), d); // rank 11-20 → unranked territory
      G.opponents.push(f);
    }
  });

  // Free agents — 3 per division
  DIVISIONS.forEach(d=>{
    for(let i=0;i<3;i++) G.freeAgents.push(genFighter(false,null,d));
  });

  genSchedule();

  // Pre-fill the first 3 fight cards with world-pool bouts immediately
  genPremadeCards(3);

  addNews('Your promotion IRON CAGE is open for business!', 1);
  addNews('You have fighters across '+playerDivs.join(', ')+'.', 1);
  addNews('World pool seeded: 8 ranked + 20 unranked per division.', 1);

  // Seed prospects
  DIVISIONS.forEach(d=>{
    for(let i=0;i<rnd(1,2);i++) G.prospects.push(genProspect(d));
  });

  // Show agency naming modal on first load — renderAll called after name is set
  setTimeout(()=>{
    const modal = document.getElementById('agency-name-modal');
    if(modal) modal.style.display='flex';
  }, 100);
}

function confirmAgencyName(){
  const input = document.getElementById('agency-name-input');
  const name = (input ? input.value.trim() : '') || 'Your Agency';
  G.agencyName = name;
  // Update header
  const hdr = document.getElementById('agency-header-name');
  if(hdr) hdr.textContent = name;
  // Close modal
  const modal = document.getElementById('agency-name-modal');
  if(modal) modal.style.display='none';
  // Now do initial render
  renderAll();
  addNews('Welcome, '+name+'! Your journey in Iron Cage begins.', 1);
}

function openRenameAgency(){
  const input = document.getElementById('agency-name-input');
  if(input) input.value = G.agencyName || '';
  const preview = document.getElementById('agency-preview');
  if(preview) preview.textContent = G.agencyName || 'Your Agency';
  const modal = document.getElementById('agency-name-modal');
  if(modal) modal.style.display='flex';
}

function addNews(txt, week){
  G.news.unshift({text:txt, week: week||G.week});
  if(G.news.length>15) G.news.pop();
}

// ===================== RENDER ALL =====================
function renderAll(){
  document.getElementById('hud-week').textContent = G.week;
  document.getElementById('hud-money').textContent = fmtMoney(G.money);
  document.getElementById('hud-rep').textContent = G.rep;
  document.getElementById('dash-wins').textContent = G.totalWins;
  document.getElementById('dash-losses').textContent = G.totalLosses;
  document.getElementById('dash-champs').textContent = G.roster.filter(f=>f.isChamp).length;
  renderDashboard();
  renderRoster();
  renderOrganization();
  renderRankings();
  renderProspects();
  renderTraining();
  renderMatchmaking();
  renderSchedule();
}

// ===================== DASHBOARD =====================
function renderDashboard(){
  // Roster quick view
  const dr = document.getElementById('dash-roster');
  if(!dr) return;
  // Agency name header on dashboard
  const agencyEl = document.getElementById('dash-agency-name');
  if(agencyEl) agencyEl.textContent = G.agencyName || 'Your Agency';
  dr.innerHTML = G.roster.map(f=>{
    const worldRank = getRankableFighters(f.division).findIndex(r=>r.id===f.id);
    const rankTag = worldRank>=0 ? `<span style="font-size:9px;color:var(--gold);font-family:'Barlow Condensed';font-weight:700;letter-spacing:1px">${fmtRank(worldRank)}</span>` : '';
    const prospectTag = f._isProspect ? `<span style="font-size:9px;color:#5DADE2;font-family:'Barlow Condensed';font-weight:700;letter-spacing:1px">PROSPECT</span>` : '';
    const bookedTag = isBooked(f.id) ? `<span style="font-size:9px;color:var(--orange);font-family:'Barlow Condensed';font-weight:600">BOOKED</span>` : '';
    return `<div onclick="showFighterProfile('${f.id}')"
      style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:3px;transition:background 0.15s"
      onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
      <div style="width:34px;height:34px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:13px;color:#fff;flex-shrink:0">${f.initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        <div style="font-size:11px;color:var(--muted)">${f.division} · ${f.wins}-${f.losses} · Cond ${f.condition}%</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        <div style="font-family:'Barlow Condensed';font-size:18px;color:var(--gold)">${f.rating}</div>
        <div style="display:flex;gap:4px">${rankTag}${prospectTag}${bookedTag}</div>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:13px;padding:12px">No fighters signed.</div>';

  // News
  const dn = document.getElementById('dash-news');
  if(!dn) return;
  dn.innerHTML = G.news.slice(0,6).map(n=>`
    <div class="news-item">
      <div class="news-dot"></div>
      <div>
        <div class="news-text">${n.text}</div>
        <div class="news-week">Week ${n.week}</div>
      </div>
    </div>`).join('') || '<div style="color:var(--muted);font-size:13px">No news yet.</div>';

  // Schedule
  const ds = document.getElementById('dash-schedule');
  if(!ds) return;
  const upcoming = G.schedule.filter(e=>e.week>=G.week).slice(0,4);
  ds.innerHTML = upcoming.map(e=>`
    <div class="event-row">
      <div class="event-week">WK ${e.week}</div>
      <div class="event-name">${e.name}</div>
      <span class="event-type ${e.type==='title'?'event-title':e.type==='main'?'event-main':'event-norm'}">${e.type.toUpperCase()}</span>
    </div>`).join('') || '<div style="color:var(--muted);padding:12px">No upcoming events</div>';

  // Rankings — only positive-record fighters
  const byDiv = getDashRankings();
  const dr2 = document.getElementById('dash-rankings');
  if(!dr2) return;
  dr2.innerHTML = DIVISIONS.map(d=>`
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--gold);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">${d}</div>
      ${(byDiv[d]||[]).map((f,i)=>`
        <div style="display:flex;gap:8px;align-items:center;padding:4px 0">
          <span style="color:var(--muted);font-size:12px;width:16px">#${i+1}</span>
          <span style="font-size:13px;flex:1">${f.name}</span>
          <span style="font-family:'Barlow Condensed';font-size:14px;color:${G.roster.find(r=>r.id===f.id)?'var(--gold)':'var(--text)'}">${f.rating}</span>
        </div>`).join('')}
    </div>`).join('');
}

// ===================== ROSTER =====================
function renderRoster(){
  const filter = document.getElementById('roster-filter')?.value || 'all';
  const fighters = filter==='all' ? G.roster : G.roster.filter(f=>f.division===filter);
  const grid = document.getElementById('roster-grid');
  if(!grid) return;
  grid.innerHTML = fighters.map(f=>fighterCard(f, true)).join('');
}

function fighterCard(f, clickable=false){
  const condColor = f.condition>70?'var(--green)':f.condition>40?'var(--orange)':'var(--red-bright)';
  const isSelected = G.selectedFighter?.id===f.id;
  const natFlag = f.nationality ? f.nationality.flag : '';
  const nickLine = f.nickname ? `<div style="font-size:10px;color:var(--gold);font-style:italic">${f.nickname}</div>` : '';
  return `<div class="fighter-card ${isSelected?'selected':''}" ${clickable?`onclick="selectFighter('${f.id}')"`:''} ondblclick="showFighterProfile('${f.id}')" title="Double-click to view full profile">
    <div class="fighter-header">
      <div class="fighter-avatar" style="background:${f.color};color:#fff">${f.initials}</div>
      <div style="flex:1;min-width:0">
        <div class="fighter-name">${f.name} <span style="font-size:14px">${natFlag}</span></div>
        ${nickLine}
        <div class="fighter-record">${f.wins}W-${f.losses}L · ${f.age}yo · ${f.style}</div>
      </div>
      <div class="fighter-rank">${f.rating}</div>
    </div>
    <div class="fighter-body">
      <span class="weight-tag">${f.division}</span>
      ${f.isChamp?'<span class="badge badge-gold" style="margin-left:6px">CHAMP</span>':''}
      ${statBar('Striking',f.striking,'#E74C3C')}
      ${statBar('Wrestling',f.wrestling,'#3498DB')}
      ${statBar('BJJ',f.bjj,'#9B59B6')}
      ${statBar('Cardio',f.cardio,'#27AE60')}
      <div class="condition-bar">
        <span class="cond-label">Condition</span>
        <div class="stat-bar" style="flex:1"><div class="stat-fill" style="width:${f.condition}%;background:${condColor}"></div></div>
        <span style="font-size:11px;width:28px;text-align:right;color:${condColor}">${f.condition}%</span>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${f.training?`<span class="badge badge-blue">${f.training}</span>`:''}
        <span style="font-size:11px;color:var(--muted)">${fmtMoney(f.salary)}/wk</span>
        <button style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--muted);font-size:10px;padding:2px 8px;border-radius:2px;cursor:pointer;font-family:'Barlow Condensed';letter-spacing:1px;text-transform:uppercase" onclick="event.stopPropagation();showFighterProfile('${f.id}')">Profile ▸</button>
      </div>
    </div>
  </div>`;
}

function statBar(label, val, color){
  return `<div class="stat-row">
    <div class="stat-label">${label}</div>
    <div class="stat-bar"><div class="stat-fill" style="width:${val}%;background:${color}"></div></div>
    <div class="stat-val">${val}</div>
  </div>`;
}

function selectFighter(id){
  G.selectedFighter = G.roster.find(f=>f.id===id) || null;
  renderTraining();
  renderMatchmaking();
  renderRoster();
}

// ===================== TRAINING =====================
const TRAINING_PROGRAMS = [
  {id:'boxing',     name:'Boxing Camp',          icon:'🥊', desc:'Jab, cross, hooks, head movement and power. Slight kick improvement.', stat:'boxing',     cost:2000, gain:[3,6]},
  {id:'kickboxing', name:'Kickboxing Training',   icon:'🦵', desc:'Low kicks, body kicks, teep, kicking power and counters. Slight boxing improvement.', stat:'kickboxing', cost:2000, gain:[3,6]},
  {id:'muaythai',   name:'Muay Thai Camp',        icon:'🔥', desc:'Clinch knees, elbows, boxing and kicking. Slight cardio and chin improvement.', stat:'muaythai',   cost:2200, gain:[3,6]},
  {id:'wrestling',  name:'Wrestling Camp',         icon:'🤼', desc:'Takedowns, sprawls and cage work.', stat:'wrestling', cost:2000, gain:[3,6]},
  {id:'bjj',        name:'BJJ Training',           icon:'🥋', desc:'Ground game, submissions and defense.', stat:'bjj',       cost:2000, gain:[3,6]},
  {id:'cardio',     name:'Cardio Conditioning',    icon:'🏃', desc:'Endurance and stamina improvement.', stat:'cardio',    cost:1500, gain:[4,7]},
  {id:'sparring',   name:'Full Sparring',          icon:'⚡', desc:'All-round improvement but injury risk.', stat:'all',    cost:1000, gain:[1,3]},
  {id:'rest',       name:'Rest & Recovery',        icon:'💤', desc:'Recover condition and morale. No stat gain.', stat:'condition', cost:0, gain:[6,7]}
];

function renderTraining(){
  // Fighter list
  const tl = document.getElementById('training-fighters');
  if(!tl) return;
  tl.innerHTML = G.roster.map(f=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;border-radius:3px;background:${G.selectedFighter?.id===f.id?'#1A1500':'transparent'};border:1px solid ${G.selectedFighter?.id===f.id?'var(--gold)':'transparent'};margin-bottom:4px" onclick="selectFighter('${f.id}')">
      <div style="width:32px;height:32px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:12px">${f.initials}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${f.name}</div>
        <div style="font-size:11px;color:var(--muted)">${f.division} · Condition ${f.condition}%</div>
      </div>
      ${f.training?`<span class="badge badge-blue" style="font-size:10px">${f.training}</span>`:''}
    </div>`).join('');

  // Training options
  const to = document.getElementById('training-options');
  const sel = G.selectedFighter;
  to.innerHTML = TRAINING_PROGRAMS.map(p=>{
    const isSel = sel && G.trainingSelections[sel.id]===p.id;
    return `<div class="training-card ${isSel?'selected':''}" onclick="selectTraining('${p.id}')">
      <div class="training-icon">${p.icon}</div>
      <div class="training-name">${p.name}</div>
      <div class="training-desc">${p.desc}</div>
      <div class="training-cost">${p.cost>0?fmtMoney(p.cost)+'/week':'Free'}</div>
    </div>`;
  }).join('');

  // Stats panel
  const ts = document.getElementById('training-stats');
  if(sel){
    ts.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:${sel.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:16px">${sel.initials}</div>
        <div>
          <div style="font-weight:700;font-size:16px">${sel.name}</div>
          <div style="font-size:12px;color:var(--muted)">${sel.style} · ${sel.division}</div>
        </div>
      </div>
      ${statBar('Striking',sel.striking,'#E74C3C')}
      ${statBar('Wrestling',sel.wrestling,'#3498DB')}
      ${statBar('BJJ',sel.bjj,'#9B59B6')}
      ${statBar('Cardio',sel.cardio,'#27AE60')}
      ${statBar('Power',sel.power,'#E67E22')}
      ${statBar('Speed',sel.speed,'#1ABC9C')}
      ${statBar('Chin',sel.chin,'#95A5A6')}`;
  } else {
    ts.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Select a fighter to view stats</div>';
  }
}

function selectTraining(programId){
  if(!G.selectedFighter){ showToast('Select a fighter first!'); return; }
  G.trainingSelections[G.selectedFighter.id] = programId;
  const p = TRAINING_PROGRAMS.find(x=>x.id===programId);
  G.selectedFighter.training = p.name;
  showToast(G.selectedFighter.first+' assigned to '+p.name);
  renderTraining();
}

// ===================== MATCHMAKING =====================
function renderMatchmaking(preselectedFighterId){
  const mf = document.getElementById('mm-your-fighter');
  if(!mf) return;
  if(!G.selectedFighter){
    mf.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Go to Roster and select a fighter</div>';
  } else {
    mf.innerHTML = fighterCard(G.selectedFighter);
  }

  const mo = document.getElementById('mm-opponents');
  if(!G.selectedFighter){ mo.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px">Select your fighter first</div>'; renderMatchup(); return; }
  const div = G.selectedFighter.division;
  // Only show opponents with positive records
  const validOpps = G.opponents.filter(o=>o.division===div && o.wins>o.losses);
  const opts = validOpps.sort((a,b)=>Math.abs(a.rating-G.selectedFighter.rating)-Math.abs(b.rating-G.selectedFighter.rating)).slice(0,10);
  mo.innerHTML = opts.map(o=>{
    const diff = o.rating - G.selectedFighter.rating;
    const diffColor = diff>10?'var(--red-bright)':diff<-10?'var(--green)':'var(--gold)';
    const isSel = G.selectedOpponent?.id===o.id;
    const oppRank = getRankableFighters(o.division).findIndex(r=>r.id===o.id);
    const rankBadge = oppRank>=0
      ? `<span style="font-size:9px;color:var(--gold);font-family:'Barlow Condensed';font-weight:700;letter-spacing:1px">${fmtRank(oppRank)}</span>`
      : `<span style="font-size:9px;color:var(--muted);font-family:'Barlow Condensed'">NR</span>`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;cursor:pointer;border-radius:3px;background:${isSel?'#1A1500':'transparent'};border:1px solid ${isSel?'var(--gold)':'transparent'};margin-bottom:4px" onclick="selectOpponent('${o.id}')">
      <div style="width:36px;height:36px;border-radius:50%;background:${o.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:12px">${o.initials}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${o.name} ${rankBadge}</div>
        <div style="font-size:11px;color:var(--muted)">${o.wins}W-${o.losses}L · ${o.style}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Barlow Condensed';font-size:18px;color:${diffColor}">${o.rating}</div>
        <div style="font-size:10px;color:${diffColor}">${diff>0?'+'+diff:diff}</div>
      </div>
    </div>`;
  }).join('');
  renderMatchup();
  renderScheduledFightsList();
}

function selectOpponent(id){
  G.selectedOpponent = G.opponents.find(o=>o.id===id);
  renderMatchmaking();
}

function renderMatchup(){
  const mm = document.getElementById('mm-matchup');
  if(!mm) return;
  if(!G.selectedFighter || !G.selectedOpponent){ mm.innerHTML=''; renderScheduledFightsList(); return; }
  const f = G.selectedFighter, o = G.selectedOpponent;
  // Check fighter not already booked
  const alreadyBooked = G.schedule.some(e=>e.fights&&e.fights.some(fi=>fi.fighterId===f.id));
  const wc = clamp(Math.round(50+(f.rating-o.rating)*0.8+(f.condition-80)*0.2),15,85);
  const purse = rnd(5000, 50000);
  G._pendingPurse = purse;

  // Upcoming events (future weeks only, not locked)
  const upcomingEvents = G.schedule.filter(e=>e.week>G.week && !e.locked).slice(0,10);

  mm.innerHTML = `<div class="card">
    <div class="card-title">Matchup Analysis</div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-bottom:16px">
      <div style="text-align:center">
        <div style="font-family:'Bebas Neue';font-size:20px">${f.name}</div>
        <div style="font-size:12px;color:var(--muted)">${f.wins}-${f.losses} · ${f.stance||'Orthodox'} · ${f.rating} RTG</div>
        ${alreadyBooked?`<div style="font-size:11px;color:var(--orange);margin-top:4px">⚠ Already booked</div>`:''}
      </div>
      <div style="font-family:'Bebas Neue';font-size:28px;color:var(--red)">VS</div>
      <div style="text-align:center">
        <div style="font-family:'Bebas Neue';font-size:20px">${o.name}</div>
        <div style="font-size:12px;color:var(--muted)">${o.wins}-${o.losses} · ${o.stance||'Orthodox'} · ${o.rating} RTG</div>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px">
        <span>Win Probability</span><span>${wc}%</span>
      </div>
      <div style="background:var(--bg4);height:8px;border-radius:4px;overflow:hidden">
        <div style="width:${wc}%;height:100%;background:${wc>60?'var(--green)':wc>40?'var(--gold)':'var(--red-bright)'};border-radius:4px"></div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div style="flex:1;background:var(--bg3);border-radius:3px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">Purse</div>
        <div style="font-family:'Barlow Condensed';font-size:18px;color:var(--gold)">${fmtMoney(purse)}</div>
      </div>
      <div style="flex:1;background:var(--bg3);border-radius:3px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">Condition</div>
        <div style="font-family:'Barlow Condensed';font-size:18px;color:var(--gold)">${f.condition}%</div>
      </div>
    </div>
    ${alreadyBooked?`<div style="text-align:center;color:var(--orange);font-size:13px;padding:8px">${f.first} is already booked on a fight card.</div>`:`
    <div>
      <div style="font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;font-weight:600">Choose Fight Card</div>
      ${upcomingEvents.length===0?'<div style="color:var(--muted);font-size:13px">No upcoming events available.</div>':
        upcomingEvents.map(e=>{
          const fightCount = e.fights?e.fights.length:0;
          const typeLabel = e.type==='title'?'TITLE':e.type==='main'?'MAIN':'STD';
          const typeColor = e.type==='title'?'var(--red-bright)':e.type==='main'?'var(--gold)':'var(--muted)';
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:3px;margin-bottom:6px;background:var(--bg3);cursor:pointer;transition:border-color 0.2s" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'" onclick="addFightToCard('${e.id}',${purse})">
            <div>
              <div style="font-weight:600;font-size:13px">${e.name}</div>
              <div style="font-size:11px;color:var(--muted)">Week ${e.week} · ${fightCount} fight${fightCount!==1?'s':''} booked</div>
            </div>
            <span style="color:${typeColor};font-size:10px;letter-spacing:1px;font-family:'Barlow Condensed';font-weight:700;margin-left:auto">${typeLabel}</span>
            <button class="btn btn-gold btn-sm">Book ▶</button>
          </div>`;
        }).join('')}
    </div>`}
  </div>`;
  renderScheduledFightsList();
}

function addFightToCard(eventId, purse){
  if(!G.selectedFighter||!G.selectedOpponent){ showToast('Select fighter and opponent first!'); return; }
  const f = G.selectedFighter, o = G.selectedOpponent;
  // Check not already booked
  const alreadyBooked = G.schedule.some(e=>e.fights&&e.fights.some(fi=>fi.fighterId===f.id));
  if(alreadyBooked){ showToast(f.first+' is already booked!'); return; }
  const evt = G.schedule.find(e=>e.id===eventId);
  if(!evt){ showToast('Event not found'); return; }
  if(!evt.fights) evt.fights=[];
  const mmIsTitle = evt.type==='title' && (evt.fights||[]).length===0;
  const mmIsMain  = (evt.fights||[]).length===0;
  evt.fights.push({
    id: 'f_'+Math.random().toString(36).slice(2),
    fighterId: f.id, opponentId: o.id, purse, result: null,
    isTitleFight: mmIsTitle,
    isMainEvent:  mmIsMain && !mmIsTitle,
    slot: mmIsTitle ? 'title' : mmIsMain ? 'main_event' : 'co_main',
    division: f.division
  });
  addNews(f.name+' vs '+o.name+' booked for '+evt.name+' (Wk '+evt.week+')', G.week);
  showToast(f.first+' vs '+o.first+' added to '+evt.name+'!');
  G.selectedOpponent = null;
  renderMatchmaking();
  renderSchedule();
}

function renderScheduledFightsList(){
  const el = document.getElementById('mm-scheduled-list');
  if(!el) return;
  // Collect all booked fights across all events
  const booked = [];
  G.schedule.forEach(e=>{
    (e.fights||[]).forEach(fi=>{
      const fighter = G.roster.find(r=>r.id===fi.fighterId);
      const opp     = [...G.opponents,...G.roster,...G.freeAgents].find(r=>r.id===fi.opponentId);
      if(fighter&&opp) booked.push({evt:e, fi, fighter, opp});
    });
  });
  if(booked.length===0){
    el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px">No fights scheduled yet. Select a fighter and opponent above, then choose a fight card.</div>';
    return;
  }
  el.innerHTML = booked.map(({evt,fi,fighter,opp})=>{
    const isPast = evt.week<=G.week;
    const statusColor = fi.result?'var(--muted)':isPast?'var(--orange)':'var(--gold)';
    const status = fi.result?fi.result:(isPast?'NEEDS FIGHT':'Wk '+evt.week);
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${fighter.name} vs ${opp.name}</div>
        <div style="font-size:11px;color:var(--muted)">${evt.name} · ${fighter.division} · ${fmtMoney(fi.purse)}</div>
      </div>
      <span style="font-size:11px;color:${statusColor};font-weight:600;letter-spacing:1px">${status}</span>
      ${!fi.result&&!isPast?`<button class="btn btn-ghost btn-sm" onclick="removeFightFromCard('${evt.id}','${fighter.id}')">✕</button>`:''}
    </div>`;
  }).join('');
}

function removeFightFromCard(eventId, fighterId){
  const evt = G.schedule.find(e=>e.id===eventId);
  if(!evt) return;
  evt.fights = (evt.fights||[]).filter(f=>f.fighterId!==fighterId);
  renderMatchmaking();
  renderSchedule();
  showToast('Fight removed from card.');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATIONAL DAMAGE + CUTS SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Initialise a fighter's location HP from their durability stats
// Head = 3/4 of chin, Body = 3/4 of body_tough, Legs = 3/4 of leg_dur
// All scaled to a 0-100 HP pool

// ═════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██  COMBAT ENGINE — SECTION 1: LOCATION HP & DAMAGE UTILITIES              ██
// ██  initLocationHP · targetLocation · tryCut · cutLabel · cutColor          ██
// ██  initCuts · applyCut · cutMentalDebuff                                   ██
// ██████████████████████████████████████████████████████████████████████████████
// ═════════════════════════════════════════════════════════════════════════════
