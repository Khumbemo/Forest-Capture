/**
 * Forest Capture - i18n Translation Engine
 * Uses a zero-interference DOM Walker approach to translate static text nodes.
 */

const dicts = {
    'hi': {
        "Forest Capture": "फॉरेस्ट कैप्चर",
        "Ecological Field Survey": "पारिस्थितिक क्षेत्र सर्वेक्षण",
        "Home": "मुख्य पृष्ठ",
        "Tools": "उपकरण",
        "Data": "डेटा",
        "LOCATION": "स्थान",
        "TEMPERATURE": "तापमान",
        "ALTITUDE": "ऊंचाई",
        "HUMIDITY": "नमी",
        "Above sea level": "समुद्र तल से ऊपर",
        "Map & GPS": "मानचित्र और GPS",
        "Quadrat": "क्वाड्रेट (Quadrat)",
        "Transect": "ट्रांसेक्ट (Transect)",
        "Environment": "पर्यावरण",
        "Disturb & CBI": "अशांति और CBI",
        "Media": "मीडिया (फ़ोटो)",
        "Analytics": "विश्लेषण",
        "Export": "निर्यात (Export)",
        "E-Herbarium": "ई-हर्बेरियम",
        "Germplasm": "जर्मप्लाज्म",
        "Settings": "सेटिंग्स",
        "Pref": "प्राथमिकताएं",
        "Lang": "भाषा (Lang)",
        "Guide": "गाइड",
        "Danger": "खतरा",
        "Account": "खाता",
        "Display": "डिस्प्ले",
        "Night": "रात (डार्क)",
        "Day": "दिन (लाइट)",
        "Sign In": "साइन इन करें",
        "Register": "रजिस्टर करें",
        "Continue Offline →": "ऑफ़लाइन जारी रखें →",
        "Select a survey...": "कोई सर्वेक्षण चुनें...",
        "New": "नया",
        "Active Survey Session": "सक्रिय सर्वेक्षण सत्र",
        "Create New Survey": "नया सर्वेक्षण बनाएँ",
        "Survey Name *": "सर्वेक्षण का नाम *",
        "Investigator": "अन्वेषक",
        "Date": "तारीख",
        "Cancel": "रद्द करें",
        "Create": "बनाएँ",
        "Save": "सहेजें",
        "Language saved (Restart app to apply)": "भाषा सहेजी गई (लागू करने के लिए ऐप पुनरारंभ करें)",
        "OK": "ठीक है",
        "Confirm": "पुष्टि करें",
        "Delete": "हटाएं"
    },
    'zh-CN': {
        "Forest Capture": "森林数据采集",
        "Ecological Field Survey": "生态野外调查",
        "Home": "主页",
        "Tools": "工具栏",
        "Data": "数据",
        "LOCATION": "定位",
        "TEMPERATURE": "温度",
        "ALTITUDE": "海拔",
        "HUMIDITY": "湿度",
        "Above sea level": "海拔高度",
        "Map & GPS": "地图与GPS",
        "Quadrat": "样方调查",
        "Transect": "样线调查",
        "Environment": "生态环境",
        "Disturb & CBI": "干扰与CBI",
        "Media": "多媒体",
        "Analytics": "数据分析",
        "Export": "数据导出",
        "E-Herbarium": "电子植物标本",
        "Germplasm": "种质资源",
        "Settings": "设置",
        "Pref": "偏好",
        "Lang": "语言 (Lang)",
        "Guide": "使用指南",
        "Danger": "危险操作",
        "Account": "账户",
        "Display": "界面显示",
        "Night": "夜间模式",
        "Day": "日间模式",
        "Sign In": "登录",
        "Register": "注册",
        "Continue Offline →": "离线继续 →",
        "Select a survey...": "选择调查项目...",
        "New": "新建",
        "Active Survey Session": "当前调查项目",
        "Create New Survey": "创建新调查",
        "Survey Name *": "调查名称 *",
        "Investigator": "调查员",
        "Date": "日期",
        "Cancel": "取消",
        "Create": "创建",
        "Save": "保存",
        "Language saved (Restart app to apply)": "语言已保存 (重新启动应用生效)",
        "OK": "确定",
        "Confirm": "确认",
        "Delete": "删除"
    }
};

// Expose dictionary keys to avoid repetitive string searching 
let activeLang = 'en';

export function setLanguage(lang) {
    if (dicts[lang] || lang === 'en') {
        activeLang = lang;
    }
}

export function t(string) {
    if (activeLang === 'en' || !dicts[activeLang]) return string;
    return dicts[activeLang][string] || string;
}

export function walkDOMAndTranslate() {
    if (activeLang === 'en' || !dicts[activeLang]) return;

    const dict = dicts[activeLang];

    // 1. Walk Text Nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodesToTranslate = [];
    while (node = walker.nextNode()) {
        const str = node.nodeValue.trim();
        if (str && dict[str]) {
             textNodesToTranslate.push({ node, str });
        }
    }
    // Update them all safely
    textNodesToTranslate.forEach(({ node, str }) => {
        node.nodeValue = node.nodeValue.replace(str, dict[str]);
    });

    // 2. Walk Input Placeholders
    const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
    inputs.forEach(input => {
        const ph = input.getAttribute('placeholder');
        if (ph && dict[ph]) {
            input.setAttribute('placeholder', dict[ph]);
        }
    });

    // 3. Walk specific Title / tooltips if needed
    const titles = document.querySelectorAll('[title]');
    titles.forEach(el => {
        const t = el.getAttribute('title');
        if (t && dict[t]) {
            el.setAttribute('title', dict[t]);
        }
    });
}
