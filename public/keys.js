const e = require("express");

// Function to scramble a string
function scrambleString(str) {
    const chars = str.split('');
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

// Original strings
const originalString1 = "vpnkjqtgadcfoebhlmirusJMzKwLAyDNQxGCPIOBHEFXñáWÉZíÚRéSÍóVTúYÁUÑÓ";
const originalString2 = "あざくひがやねのかそじこわらとゅたまぜし青緑つうょづび真すでえどり数るぎゆゞちめろげぶゑゎゕぬゐふゝへゃほみぉぱばよべぼだもにぢ物をんおぽけれ場例きせいぺナワヌオクトエアイゼギソマニコヤレヨケムリカルハメモンネタシスノヒサロラフガユ運ゴキ根ヘ計ジダズグザゲヂテ山海川北三前高九金風左小南四大西土雨日十火低木中後右八圓月水上下東空子年本国会社学校家車駅病院店買売食飲読書写心新古長短黒白赤";

// Generate 100 scrambled key pairs
const generateKeys = () => {
    const keys = [];
    for (let i = 0; i < 100; i++) {
        keys.push([
            scrambleString(originalString1),
            scrambleString(originalString2)
        ]);
    }
    return keys;
};

exports.keys = generateKeys();