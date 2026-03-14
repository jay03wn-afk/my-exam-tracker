import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, BookOpen, Users, LogOut, ArrowLeft, Trophy, ChevronRight, Activity 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// === 國考科目與章節資料結構 ===
const EXAM_DATA = [
  {
    id: "s1",
    title: "藥理學與藥物化學",
    categories: [
      {
        id: "s1_c1",
        title: "全範圍",
        parts: ["藥理", "藥化"], // 每個章節分成這兩個部分 (各 3 個按鈕 = 6 個按鈕)
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
        chapters: [
          "生物鹼", "配醣體", "揮發油", "苯丙烷", "萜類", "強心苷", 
          "碳水化合物", "單寧", "樹脂", "脂質", "類固醇", "緒論"
        ]
      },
      {
        id: "s2_c3",
        title: "中藥學",
        parts: ["中藥"],
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
        chapters: [
          "緒論", "藥物動力學模型", "I.V. (一室、二室)", "E.V. (一室、二室)", 
          "I.V. infusion/多劑量給藥", "非線性藥物動力學", "藥物吸收", 
          "生體可用率/生體相等性", "藥物分布", "藥物代謝的遺傳多形性", "藥物排除/腎病調整"
        ]
      }
    ]
  }
];

const TASK_WEIGHTS = { skim: 20, read: 40, exam: 40 };

// 預先計算總分
let GLOBAL_TOTAL_POINTS = 0;
const SUBJECT_TOTAL_POINTS = {};

EXAM_DATA.forEach(subj => {
  let subjPoints = 0;
  subj.categories.forEach(cat => {
    // 每個章節有 N 個 parts，每個 part 滿分 100 (20+40+40)
    const catPoints = cat.chapters.length * cat.parts.length * 100;
    subjPoints += catPoints;
  });
  SUBJECT_TOTAL_POINTS[subj.id] = subjPoints;
  GLOBAL_TOTAL_POINTS += subjPoints;
});

// === Firebase 初始化與設定 ===
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
const appId = 'exam-tracker-v1'; // 固定這個 ID


export default function App() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  
  const [nickname, setNickname] = useState(() => localStorage.getItem('exam_nickname') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [myTasks, setMyTasks] = useState([]);
  const [allUsersData, setAllUsersData] = useState([]);
  
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // 1. 初始化登入與監聽
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoaded(true);
      if (nickname) {
        setIsLoggedIn(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽 Firebase 資料
  useEffect(() => {
    if (!user || !isLoggedIn || !nickname) return;

    const progressRef = collection(db, 'artifacts', appId, 'public', 'data', 'userProgress');
    
    const unsubscribe = onSnapshot(progressRef, (snapshot) => {
      const users = [];
      let foundMyData = false;
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id === nickname) {
          setMyTasks(data.tasks || []);
          foundMyData = true;
        }
        users.push({
          nickname: docSnap.id,
          totalPoints: data.totalPoints || 0,
          updatedAt: data.updatedAt || 0
        });
      });

      // 初始化自己的資料庫文件
      if (!foundMyData) {
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userProgress', nickname), {
          tasks: [],
          totalPoints: 0,
          updatedAt: Date.now()
        }, { merge: true });
      }

      // 排行榜排序
      users.sort((a, b) => b.totalPoints - a.totalPoints);
      setAllUsersData(users);

    }, (err) => {
      console.error("Firestore Listen Error:", err);
    });

    return () => unsubscribe();
  }, [user, isLoggedIn, nickname]);

  // 登入處理
  const handleLogin = (e) => {
    e.preventDefault();
    const nameStr = nickname.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    if (!nameStr) return;
    setNickname(nameStr);
    localStorage.setItem('exam_nickname', nameStr);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setNickname('');
    localStorage.removeItem('exam_nickname');
    setMyTasks([]);
    setActiveSubjectId(null);
  };

  // 任務切換與分數計算
  const toggleTask = async (taskId) => {
    const newTasks = myTasks.includes(taskId)
      ? myTasks.filter(t => t !== taskId)
      : [...myTasks, taskId];
    
    // Optimistic UI update
    setMyTasks(newTasks);

    // 計算新總分
    let points = 0;
    newTasks.forEach(t => {
      if (t.endsWith('_skim')) points += TASK_WEIGHTS.skim;
      if (t.endsWith('_read')) points += TASK_WEIGHTS.read;
      if (t.endsWith('_exam')) points += TASK_WEIGHTS.exam;
    });

    // 寫入 Firebase
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userProgress', nickname), {
        tasks: newTasks,
        totalPoints: points,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving task:", err);
    }
  };

  // 進度計算工具
  const calculatePoints = (tasks, subjectId = null) => {
    let points = 0;
    tasks.forEach(t => {
      if (subjectId && !t.startsWith(`${subjectId}_`)) return;
      if (t.endsWith('_skim')) points += TASK_WEIGHTS.skim;
      if (t.endsWith('_read')) points += TASK_WEIGHTS.read;
      if (t.endsWith('_exam')) points += TASK_WEIGHTS.exam;
    });
    return points;
  };

  const myTotalPoints = useMemo(() => calculatePoints(myTasks), [myTasks]);
  const overallProgress = ((myTotalPoints / GLOBAL_TOTAL_POINTS) * 100).toFixed(1);

  if (!authLoaded) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center font-sans">載入中...</div>;
  }

  // --- 登入畫面 ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 font-sans selection:bg-neutral-800">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <BookOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">國考進度追蹤</h1>
          <p className="text-neutral-400 text-sm mb-8 text-center">輸入暱稱自動存檔，隨時隨地離線接續進度。</p>
          
          <input
            type="text"
            placeholder="請輸入你的暱稱..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition-colors mb-4"
            required
            maxLength={15}
          />
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 transition-colors">
            開始使用
          </button>
        </form>
      </div>
    );
  }

  // --- 主介面 ---
  const activeSubject = EXAM_DATA.find(s => s.id === activeSubjectId);
  const activeCategory = activeSubject?.categories.find(c => c.id === activeCategoryId) || activeSubject?.categories[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-neutral-800 pb-20">
      
      {/* 頂部導航列 */}
      <nav className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeSubject ? (
              <button onClick={() => setActiveSubjectId(null)} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-bold">
                <Activity size={18} />
              </div>
            )}
            <h1 className="font-bold text-lg hidden sm:block">
              {activeSubject ? activeSubject.title : "國考總攬"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-2 text-sm font-medium bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full hover:bg-neutral-800 transition-colors"
            >
              <Trophy size={16} /> <span>排行榜</span>
            </button>
            <div className="flex items-center gap-2 text-sm text-neutral-400 border-l border-neutral-800 pl-4">
              <Users size={16} /> <span className="hidden sm:inline">{nickname}</span>
              <button onClick={handleLogout} className="ml-2 hover:text-white transition-colors" title="登出">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* === 總覽頁面 === */}
        {!activeSubject && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 總進度卡片 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              <h2 className="text-neutral-400 font-medium mb-2 relative z-10">總完成進度</h2>
              <div className="flex items-end gap-2 mb-4 relative z-10">
                <span className="text-5xl font-black">{overallProgress}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden relative z-10">
                <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>

            {/* 科目列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXAM_DATA.map(subj => {
                const subjPoints = calculatePoints(myTasks, subj.id);
                const subjMax = SUBJECT_TOTAL_POINTS[subj.id];
                const subjPercent = subjMax === 0 ? 0 : ((subjPoints / subjMax) * 100).toFixed(1);

                return (
                  <div 
                    key={subj.id}
                    onClick={() => {
                      setActiveSubjectId(subj.id);
                      setActiveCategoryId(subj.categories[0].id);
                    }}
                    className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="font-bold text-lg leading-snug pr-4">{subj.title}</h3>
                      <div className="w-8 h-8 rounded-full bg-neutral-950 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors shrink-0">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-neutral-400 mb-2">
                        <span>進度</span>
                        <span>{subjPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                        <div className="h-full bg-neutral-400 group-hover:bg-white transition-all duration-500" style={{ width: `${subjPercent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === 科目詳細頁面 === */}
        {activeSubject && activeCategory && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-bold mb-6 sm:hidden">{activeSubject.title}</h2>
            
            {/* 分類標籤 (如果該科目有多個分類) */}
            {activeSubject.categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide">
                {activeSubject.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-colors ${
                      activeCategoryId === cat.id 
                        ? 'bg-white text-black' 
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                    }`}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>
            )}

            {/* 進度提示說明 */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mb-6 bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/50">
              <span className="font-bold text-neutral-300">權重說明：</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white opacity-40"></span>略(略讀 20%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white opacity-70"></span>細(細讀 40%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white"></span>題(國考題 40%)</span>
            </div>

            {/* 章節網格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeCategory.chapters.map((chapTitle, chapIdx) => {
                const chapterNum = chapIdx + 1;
                // 若標題已經有數字，就不額外加編號
                const displayTitle = /^\d/.test(chapTitle) ? chapTitle : `${chapterNum}. ${chapTitle}`;
                
                return (
                  <div key={chapIdx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="text-sm font-bold text-white leading-tight mb-1">{displayTitle}</div>
                    
                    <div className="flex flex-col gap-2 mt-auto">
                      {activeCategory.parts.map((partName, partIdx) => {
                        const baseKey = `${activeSubject.id}_${activeCategory.id}_${chapIdx}_${partIdx}`;
                        const isSkim = myTasks.includes(`${baseKey}_skim`);
                        const isRead = myTasks.includes(`${baseKey}_read`);
                        const isExam = myTasks.includes(`${baseKey}_exam`);

                        return (
                          <div key={partIdx} className="flex items-center justify-between bg-neutral-950 p-2 rounded-xl">
                            <span className="text-xs font-medium text-neutral-400 ml-1">{partName}</span>
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => toggleTask(`${baseKey}_skim`)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${isSkim ? 'bg-neutral-700 text-white' : 'border border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}
                                title="略讀 (20%)"
                              >
                                略
                              </button>
                              <button 
                                onClick={() => toggleTask(`${baseKey}_read`)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${isRead ? 'bg-neutral-300 text-black' : 'border border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}
                                title="細讀 (40%)"
                              >
                                細
                              </button>
                              <button 
                                onClick={() => toggleTask(`${baseKey}_exam`)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${isExam ? 'bg-white text-black' : 'border border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}
                                title="國考題 (40%)"
                              >
                                題
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* 排行榜 Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Trophy size={20} className="text-white" /> 戰力排行榜
              </h3>
              <button onClick={() => setShowLeaderboard(false)} className="text-neutral-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {allUsersData.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-sm">暫無資料</div>
              ) : (
                allUsersData.map((u, idx) => {
                  const percent = ((u.totalPoints / GLOBAL_TOTAL_POINTS) * 100).toFixed(1);
                  const isMe = u.nickname === nickname;
                  return (
                    <div key={idx} className={`flex items-center justify-between p-4 my-1 rounded-2xl ${isMe ? 'bg-white text-black' : 'bg-transparent text-white hover:bg-neutral-800'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 text-center font-bold ${isMe ? 'text-black' : 'text-neutral-500'}`}>{idx + 1}</div>
                        <div className="font-medium">{u.nickname} {isMe && '(你)'}</div>
                      </div>
                      <div className="font-black">{percent}%</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
