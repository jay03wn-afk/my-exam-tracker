import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, BookOpen, Users, LogOut, ArrowLeft, Trophy, ChevronRight, Activity 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// === 國考科目與章節資料結構 (根據 PDF 權重更新)  ===
const EXAM_DATA = [
  {
    id: "s1",
    title: "藥理學與藥物化學",
    categories: [
      {
        id: "s1_c1",
        title: "全範圍",
        parts: ["藥理", "藥化"],
        chapterWeights: [
          8.8, 3.2, 3.9, 0.4, 2.2, 3.0, 0.6, 1.1, 2.8, 2.4, 1.9, 0.9, 3.6, 3.2, 0.2, 1.7, 1.3, 1.5, 1.5, 0.2,
          3.0, 3.9, 2.8, 3.6, 1.5, 0.7, 1.9, 2.4, 0.6, 1.7, 1.3, 2.8, 5.0, 1.5, 1.9, 7.3, 2.8, 0.4
        ],
        chapters: [
          "藥效學/藥動學", "擬交感神經藥", "擬副交感神經藥", "鴉片類/中樞神經藥", "局部/全身麻醉藥", 
          "鎮靜安眠藥", "抗焦慮藥", "神經肌肉疾病", "抗癲癇藥", "抗憂鬱/抗躁鬱", "抗精神藥", 
          "抗帕金森藥", "麻醉性鎮痛藥", "非類固醇消炎藥", "痛風", "類固醇藥物", "血清素", 
          "抗組織胺", "抗潰瘍", "止吐、止瀉、瀉劑", "高血壓藥", "利尿劑", "糖尿病藥", 
          "高血脂藥", "心衰竭", "心絞痛", "心律不整", "抗凝血藥", "貧血藥", "下視丘/腦下垂體", 
          "甲狀腺素", "固醇類", "抗生素", "肺結核", "抗黴菌", "抗癌藥", "抗病毒", "抗瘧疾/原蟲"
        ]
      }
    ]
  },
  {
    id: "s2",
    title: "藥物分析學與生藥學",
    categories: [
      {
        id: "s2_c1",
        title: "藥物分析學",
        parts: ["藥分"],
        chapterWeights: [
          3.66, 1.93, 1.16, 1.35, 0.58, 3.47, 0.87, 0.29, 1.35, 2.50, 0.77, 1.83, 1.73, 0.58, 0.96, 1.83, 2.50,
          5.59, 2.22, 10.12, 5.30, 0.67, 3.28, 3.56, 5.59, 8.00, 2.89, 8.86, 4.34, 2.60, 0.87, 2.70, 1.83, 8.75, 0.10
        ],
        chapters: [
          "基礎概念", "水溶液概論", "滴定分析概論", "酸滴定", "鹼滴定", "非水滴定", "沉澱滴定", 
          "錯合滴定", "氧化還原滴定", "水分測定法", "灰分測定法", "脂肪測定法", "揮發油測定法", 
          "生物鹼及胺類測定法", "重金屬檢測", "藥典試驗補充(含中藥)", "其他分析法", "層析概論", 
          "薄層層析法(TLC)", "高效能液相層析法(HPLC)", "氣相層析法(GC)", "超臨界流體層析法(SFC)", 
          "萃取法", "毛細管電泳(CE)", "質譜儀分析法(MS)", "光譜概論", "紫外光與可見光譜(UV/VIS)", 
          "紅外光譜(IR)", "螢光光譜(FLUOR)", "拉曼光譜", "原子光譜(AES/AAS)", "旋光度測定法", 
          "折光率測定法", "核磁共振光譜測定(NMR)", "生物製劑品管分析"
        ]
      },
      {
        id: "s2_c2",
        title: "生藥學",
        parts: ["生藥"],
        chapterWeights: [28.8, 17.3, 9.6, 7.7, 7.7, 5.8, 5.8, 5.8, 5.8, 3.8, 1.9, 0.1],
        chapters: [
          "生物鹼", "配醣體", "揮發油", "苯丙烷", "萜類", "強心苷", 
          "碳水化合物", "單寧", "樹脂", "脂質", "類固醇", "緒論"
        ]
      },
      {
        id: "s2_c3",
        title: "中藥學",
        parts: ["中藥"],
        chapterWeights: [21.6, 15.4, 9.9, 7.4, 6.2, 6.2, 4.9, 4.9, 4.3, 3.7, 3.1, 3.1, 2.5, 1.9, 1.9, 1.2, 0.6, 0.6, 0.6],
        chapters: [
          "補虛藥", "清熱藥", "解表藥", "化痰止咳平喘", "利水滲濕藥", "活血祛瘀藥", 
          "祛風濕藥", "理氣藥", "止血藥", "安神藥", "收澀藥", "平肝息風藥", "攻下藥", 
          "溫裹藥", "芳香化濕藥", "消食藥", "清虛熱藥", "外用藥", "驅蟲藥"
        ]
      }
    ]
  },
  {
    id: "s3",
    title: "藥劑學與生物藥劑學",
    categories: [
      {
        id: "s3_c1",
        title: "藥劑學",
        parts: ["藥劑"],
        chapterWeights: [
          4.17, 0.83, 3.33, 1.67, 1.67, 2.50, 5.83, 2.50, 3.33, 5.00, 5.00, 2.50, 7.50, 1.67, 2.50, 1.67, 3.33, 7.50, 4.17, 1.67
        ],
        chapters: [
          "大雜燴(總論)", "芳香水劑", "溶液劑", "糖漿劑", "醋劑/酊劑", "流浸膏劑/浸膏劑/浸劑", 
          "膠體/界面活性劑", "流變", "浮劑/洗劑(懸浮劑)", "乳劑", "軟膏劑", "凝膠/乳糜/乳霜/糊劑", 
          "注射劑", "眼用製劑", "栓劑", "微粒學", "散劑/丸劑", "錠劑", "膠囊", "氣化噴霧劑"
        ]
      },
      {
        id: "s3_c2",
        title: "生物藥劑學",
        parts: ["生藥劑"],
        chapterWeights: [1.67, 0.83, 4.17, 1.67, 1.67, 1.67, 5.00, 5.00, 3.33, 2.50, 4.17],
        chapters: [
          "緒論", "藥物動力學模型", "I.V. (一室、二室)", "E.V. (一室、二室)", 
          "I.V. infusion/多劑量給藥", "非線性藥物動力學", "藥物吸收", 
          "生體可用率/生體相等性", "藥物分布", "藥物代謝的遺傳多形性", "藥物排除/腎病調整"
        ]
      }
    ]
  }
];

const TASK_WEIGHTS = { skim: 0.2, read: 0.4, exam: 0.4 };

const calculateTotalGlobalPoints = () => {
  let total = 0;
  EXAM_DATA.forEach(subj => {
    subj.categories.forEach(cat => {
      const catWeightSum = cat.chapterWeights ? cat.chapterWeights.reduce((a, b) => a + b, 0) : cat.chapters.length;
      total += catWeightSum * cat.parts.length;
    });
  });
  return total;
};
const GLOBAL_TOTAL_POINTS = calculateTotalGlobalPoints();

const firebaseConfig = {
  apiKey: "AIzaSyBwPNXg4zU8R2rjt0AxqBVz62rDY4aOBOE",
  authDomain: "exam-tracker-ae31d.firebaseapp.com",
  projectId: "exam-tracker-ae31d",
  storageBucket: "exam-tracker-ae31d.firebasestorage.app",
  messagingSenderId: "115531307122",
  appId: "1:115531307122:web:93c00b924f9d5231458aeb",
  measurementId: "G-055NBM4J2J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'exam-tracker-v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [account, setAccount] = useState(() => localStorage.getItem('exam_account') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputAccount, setInputAccount] = useState('');
  
  const [myTasks, setMyTasks] = useState([]);
  const [allUsersData, setAllUsersData] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoaded(true);
      if (account) setIsLoggedIn(true);
    });
    return () => unsubscribe();
  }, [account]);

  useEffect(() => {
    if (!user || !isLoggedIn || !account) return;
    const progressRef = collection(db, 'artifacts', appId, 'public', 'data', 'userProgress');
    const unsubscribe = onSnapshot(progressRef, (snapshot) => {
      const users = [];
      let foundMyData = false;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id === account) {
          setMyTasks(data.tasks || []);
          foundMyData = true;
        }
        users.push({ nickname: docSnap.id, totalPoints: data.totalPoints || 0 });
      });
      if (!foundMyData) {
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userProgress', account), {
          tasks: [], totalPoints: 0, updatedAt: Date.now()
        }, { merge: true });
      }
      users.sort((a, b) => b.totalPoints - a.totalPoints);
      setAllUsersData(users);
    });
    return () => unsubscribe();
  }, [user, isLoggedIn, account]);

  const calculatePoints = (tasks, targetSubjId = null) => {
    let points = 0;
    EXAM_DATA.forEach(subj => {
      if (targetSubjId && subj.id !== targetSubjId) return;
      subj.categories.forEach(cat => {
        cat.chapters.forEach((_, chapIdx) => {
          cat.parts.forEach((_, partIdx) => {
            const weight = cat.chapterWeights ? cat.chapterWeights[chapIdx] : 1;
            const baseKey = `${subj.id}_${cat.id}_${chapIdx}_${partIdx}`;
            if (tasks.includes(`${baseKey}_skim`)) points += weight * TASK_WEIGHTS.skim;
            if (tasks.includes(`${baseKey}_read`)) points += weight * TASK_WEIGHTS.read;
            if (tasks.includes(`${baseKey}_exam`)) points += weight * TASK_WEIGHTS.exam;
          });
        });
      });
    });
    return points;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanAccount = inputAccount.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    if (!cleanAccount) return;
    setAccount(cleanAccount);
    localStorage.setItem('exam_account', cleanAccount);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('exam_account');
    setAccount('');
    setIsLoggedIn(false);
  };

  const toggleTask = async (taskId) => {
    const newTasks = myTasks.includes(taskId) ? myTasks.filter(t => t !== taskId) : [...myTasks, taskId];
    setMyTasks(newTasks);
    const points = calculatePoints(newTasks);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userProgress', account), {
        tasks: newTasks, totalPoints: points, updatedAt: Date.now()
      }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const myTotalPoints = useMemo(() => calculatePoints(myTasks), [myTasks]);
  const overallProgress = ((myTotalPoints / GLOBAL_TOTAL_POINTS) * 100).toFixed(1);

  if (!authLoaded) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">載入中...</div>;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 p-8 rounded-3xl border border-neutral-800 flex flex-col items-center">
          <Activity size={48} className="mb-6" />
          <h1 className="text-2xl font-bold mb-4">國考戰力系統</h1>
          <input 
            type="text" placeholder="請輸入帳號..." value={inputAccount} 
            onChange={(e) => setInputAccount(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 mb-4 outline-none focus:border-white"
            required 
          />
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl">登入系統</button>
        </form>
      </div>
    );
  }

  const activeSubject = EXAM_DATA.find(s => s.id === activeSubjectId);
  const activeCategory = activeSubject?.categories.find(c => c.id === activeCategoryId) || activeSubject?.categories[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-20 font-sans">
      <nav className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {activeSubject && <button onClick={() => setActiveSubjectId(null)}><ArrowLeft size={20}/></button>}
          <h1 className="font-bold">{activeSubject ? activeSubject.title : "戰力總覽"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowLeaderboard(true)} className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800 text-sm">
            <Trophy size={16} /> 排行榜
          </button>
          <button onClick={handleLogout} className="text-neutral-500 hover:text-white"><LogOut size={18}/></button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!activeSubject ? (
          <div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 mb-8">
              <h2 className="text-neutral-400 mb-2">Hi, {account}</h2>
              <div className="text-5xl font-black mb-4">{overallProgress}%</div>
              <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXAM_DATA.map(subj => {
                const subjTotal = subj.categories.reduce((acc, cat) => acc + (cat.chapterWeights ? cat.chapterWeights.reduce((a, b) => a + b, 0) : cat.chapters.length) * cat.parts.length, 0);
                const p = ((calculatePoints(myTasks, subj.id) / subjTotal) * 100).toFixed(1);
                return (
                  <div key={subj.id} onClick={() => {setActiveSubjectId(subj.id); setActiveCategoryId(subj.categories[0].id);}} className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl cursor-pointer hover:border-white transition-all">
                    <h3 className="font-bold mb-4">{subj.title}</h3>
                    <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-400" style={{ width: `${p}%` }} />
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500 text-right">{p}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 overflow-x-auto mb-6 pb-2">
              {activeSubject.categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCategoryId === cat.id ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}>
                  {cat.title}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCategory.chapters.map((chap, idx) => (
                <div key={idx} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex flex-col">
                  <div className="text-sm font-bold mb-3 flex justify-between">
                    <span>{idx + 1}. {chap}</span>
                    <span className="text-[10px] text-neutral-500">{activeCategory.chapterWeights[idx]}%</span>
                  </div>
                  <div className="mt-auto space-y-1.5">
                    {activeCategory.parts.map((part, pIdx) => {
                      const key = `${activeSubject.id}_${activeCategory.id}_${idx}_${pIdx}`;
                      return (
                        <div key={pIdx} className="flex items-center justify-between bg-neutral-950 p-2 rounded-xl">
                          <span className="text-[11px] text-neutral-500 font-medium ml-1">{part}</span>
                          <div className="flex gap-1">
                            {['skim', 'read', 'exam'].map(type => (
                              <button key={type} onClick={() => toggleTask(`${key}_${type}`)} className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${myTasks.includes(`${key}_${type}`) ? 'bg-white text-black' : 'border border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}>
                                {type === 'skim' ? '略' : type === 'read' ? '細' : '題'}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
              <h3 className="font-bold flex items-center gap-2"><Trophy size={20}/> 戰力排行榜</h3>
              <button onClick={() => setShowLeaderboard(false)}>✕</button>
            </div>
            <div className="overflow-y-auto p-2">
              {allUsersData.map((u, idx) => (
                <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl mb-1 ${u.nickname === account ? 'bg-white text-black' : 'text-white'}`}>
                  <span>{idx + 1}. {u.nickname}</span>
                  <span className="font-black">{((u.totalPoints / GLOBAL_TOTAL_POINTS) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
