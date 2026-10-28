import { createContext, useContext } from 'react'
import { activeSchools, schoolMap } from './data.js'

// Every piece of on-screen text, in English and Japanese. Results sent to the Google Sheet stay
// in English so the ranking doesn't split by language.
const strings = {
  en: {
    brand: 'Prince of Tennis best face',
    allTeams: 'All teams',
    sortByTeam: 'Sort by team',
    chooseTeam: 'Choose a team',
    title: (n) => [null, `Top ${n}`, ' Faces'],
    sub: 'Pick the face you like better.',
    count: (n, total, team) => `Your Top ${n} from ${total} characters${team ? ` in ${team}` : ''}.`,
    start: 'Start →',
    resume: (team) => `Resume where I left off (${team})`,
    home: '⌂ Home',
    question: 'Which face do you like best?',
    back: '← Back',
    neitherHint: 'Like neither?',
    neither: 'Skip both ✕',
    keys: 'Keyboard: ← left · → right · ↓ neither',
    yourResult: 'Your result',
    resultTitle: (n) => ['My ', `Top ${n}`, ' Faces'],
    imageTitle: (n) => `My Top ${n} Faces`,
    rank: (n) => `#${n}`,
    save: 'Save image',
    preparing: 'Preparing image…',
    startOver: 'Start over',
    downloadStarted: 'Download started. Check your Downloads folder.',
    imageFailed: 'Could not create the image',
    saveDialog: 'Save your image',
    pressHold: <>Press and hold the image, then choose <b>Save to Photos</b> or <b>Download image</b>.</>,
    inAppTip: <>Not working? Open this page in Chrome or Safari: tap <b>⋯</b> and choose <b>Open in browser</b>.</>,
    close: 'Close',
    noFaces: 'No faces picked',
    noFacesSub: 'You chose "Neither" for everyone, so there\'s no top list this time.',
    undo: '← Undo last choice',
    footer: <>For any bugs or errors, please leave a message on my wavebox.<br />Support &amp; thanks also appreciated!</>,
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    otherLanguage: '日本語',
    otherLanguageLabel: 'Switch to Japanese',
    teamsCount: (n) => `${n} teams`,
    clearSelection: 'Clear selection',
    pickTeam: 'Pick at least one team to start.',
    about: 'About',
    updates: 'Updates',
    updatesTitle: 'Updates',
    // Newest first. Dates are YYYY-MM-DD and shown in the page language.
    updatesList: [
      {
        date: '2026-10-28',
        items: [
          'New team: Spain (Julio Roman coming soon)',
          'New character: Futa Kaji (U-17)',
          'New photos for Atsushi Kisarazu, Shinya Yanagisawa and Kojiro Saeki',
        ],
      },
    ],
    teamTip: 'Tip: tick or untick the boxes to choose which teams are in your ranking.',
    teamTipClose: 'Got it',
    contact: 'Contact',
    aboutTitle: 'About',
    madeBy: 'made by',
    imageCredit: 'sorter made by ube',
    imageScan: 'Scan to make your own Top 9',
    previewTitle: 'Preview',
    share: 'Save / Share',
    download: 'Download image',
    pressHoldShort: 'If nothing was saved, press and hold the image above.',
    filledNote: (picked, total) => `Your top ${picked} selection is less than ${total} so we have brought some characters back to fill in the empty spots.`,
    welcomeTitle: 'Before you start',
    welcomeText: (wavebox) => <>Some characters are still not available in this ranking.<br />We are collecting pictures for characters who are not present in <span className="nowrap">Rising Beat</span>. Please feel free to submit via {wavebox} (upload it first).</>,
    welcomeContinue: 'Continue →',
  },
  ja: {
    brand: 'テニプリ 好き顔ランキング',
    allTeams: '全チーム',
    sortByTeam: 'チームで選ぶ',
    chooseTeam: 'チームを選ぶ',
    title: (n) => ['好き顔', `TOP${n}`, null],
    sub: '好きな顔を選んでください。',
    count: (n, total, team) => `${team ? `${team}の` : ''}${total}人から、あなたのTOP${n}を。`,
    start: 'スタート →',
    resume: (team) => `続きから再開（${team}）`,
    home: '⌂ ホーム',
    question: 'どっちの顔が好き？',
    back: '← 戻る',
    neitherHint: 'どちらも違う？',
    neither: '両方スキップ ✕',
    keys: 'キーボード：← 左 · → 右 · ↓ どちらも',
    yourResult: 'あなたの結果',
    resultTitle: (n) => ['私の好き顔', `TOP${n}`, null],
    imageTitle: (n) => `私の好き顔TOP${n}`,
    rank: (n) => `${n}位`,
    save: '画像を保存',
    preparing: '画像を準備中…',
    startOver: 'もう一度',
    downloadStarted: 'ダウンロードを開始しました。ダウンロードフォルダを確認してください。',
    imageFailed: '画像を作成できませんでした',
    saveDialog: '画像を保存',
    pressHold: <>画像を長押しして、<b>「写真に保存」</b>または<b>「画像をダウンロード」</b>を選んでください。</>,
    inAppTip: <>うまくいかない場合は、<b>⋯</b>から<b>「ブラウザで開く」</b>を選び、ChromeやSafariで開いてください。</>,
    close: '閉じる',
    noFaces: '選ばれた顔がありません',
    noFacesSub: '全員「両方スキップ」を選んだため、今回はランキングがありません。',
    undo: '← 最後の選択を取り消す',
    footer: <>不具合やエラーはwaveboxへメッセージをお願いします。<br />応援や感謝のメッセージも嬉しいです！</>,
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    otherLanguage: 'English',
    otherLanguageLabel: '英語に切り替える',
    teamsCount: (n) => `${n}チーム`,
    clearSelection: '選択をクリア',
    pickTeam: 'チームを1つ以上選んでください。',
    about: 'About',
    updates: 'Updates',
    updatesTitle: '更新情報',
    updatesList: [
      {
        date: '2026-10-28',
        items: [
          '新チーム：スペイン代表（フリオ・ロマンは近日追加）',
          '新キャラクター：加治 風多（U-17）',
          '木更津 淳・柳沢慎也・佐伯虎次郎の写真を更新',
        ],
      },
    ],
    teamTip: 'ヒント：チェックを付けたり外したりして、ランキングに入れるチームを選べます。',
    teamTipClose: 'OK',
    contact: 'Contact',
    aboutTitle: 'このサイトについて',
    madeBy: '制作',
    imageCredit: 'sorter made by ube',
    imageScan: 'QRコードからあなたのTOP9も作れます',
    previewTitle: 'プレビュー',
    share: '保存・共有',
    download: '画像をダウンロード',
    pressHoldShort: '保存されない場合は、上の画像を長押ししてください。',
    filledNote: (picked, total) => `選ばれたのが${picked}人で${total}人に満たなかったため、空いた枠にスキップしたキャラクターを戻しています。`,
    welcomeTitle: 'はじめに',
    welcomeText: (wavebox) => <>このランキングには、まだ登場していないキャラクターがいます。<span className="nowrap">Rising Beat（テニラビ）</span>に登場しないキャラクターの写真を<span className="nowrap">募集しています。</span><br />{wavebox}からお気軽にお送りください（画像のURLでお願いします）。</>,
    welcomeContinue: '次へ →',
  },
}

export const LangContext = createContext('en')

// Text plus name helpers for the current language.
export const useT = () => {
  const lang = useContext(LangContext)
  return { lang, ...textFor(lang) }
}

export const textFor = (lang) => {
  const t = strings[lang] || strings.en
  const ja = lang === 'ja'
  return {
    t,
    // Main name and the smaller name under it: Japanese first in Japanese mode.
    nameOf: (player) => (ja && player.nameJa ? player.nameJa : player.name),
    altNameOf: (player) => (ja ? player.name : player.nameJa),
    teamName,
    // A mix of teams: "All teams", one name, up to three joined with +, or a count.
    teamsLabel: (teams = []) => {
      if (teams.length === activeSchools.length) return t.allTeams
      if (teams.length <= 3) return teams.map(teamName).join(' + ')
      return t.teamsCount(teams.length)
    },
  }
  function teamName(team) {
    return team === 'all' ? t.allTeams : (ja && schoolMap[team].nameJa) || schoolMap[team].name
  }
}

// Renders [before, accent, after] with the middle part in the gradient accent style.
export const Accented = ({ parts }) => (
  <>
    {parts[0]}
    <span className="accent">{parts[1]}</span>
    {parts[2]}
  </>
)
