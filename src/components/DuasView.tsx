import React from 'react';
import { Dua } from '../types';

const IA_DUAS: Dua[] = [
  {c:"صبح اٹھ کر پڑھنے کی دعا",ar:"أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ",ur:"ہم نے صبح کی اور سارا ملک اللہ ہی کا ہے، اور سب تعریف اللہ کے لیے ہے۔"},
  {c:"رات کو سونے کی دعا",ar:"بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",ur:"اے اللہ! تیرے نام کے ساتھ میں مرتا ہوں اور جیتا ہوں۔"},
  {c:"کھانا شروع کرنے کی دعا",ar:"بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ",ur:"میں اللہ کے نام سے اور اللہ کی برکت کے ساتھ کھانا شروع کرتا ہوں۔"},
  {c:"کھانے کے بعد کی دعا",ar:"الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ",ur:"سب تعریفیں اللہ ہی کے لیے ہیں جس نے ہمیں کھلایا پلایا اور مسلمان بنایا۔"},
  {c:"گھر سے نکلتے وقت کی دعا",ar:"بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",ur:"اللہ کے نام کے ساتھ، میں نے اللہ پر توکل کیا، ہر طاقت اللہ ہی سے ہے۔"},
  {c:"گھر میں داخل ہوتے وقت کی دعا",ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ",ur:"اے اللہ! میں تجھ سے گھر داخل ہونے اور باہر نکلنے کی بھلائی کا طالب ہوں۔"},
  {c:"مسجد میں داخل ہونے کی دعا",ar:"اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",ur:"اے اللہ! میرے لیے اپنی رحمت کے دروازے کھول دے۔"},
  {c:"مسجد سے نکلتے وقت کی دعا",ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",ur:"اے اللہ! میں تجھ سے تیرے فضل کا سوال کرتا ہوں۔"},
  {c:"استغفار کی جامع دعا",ar:"أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ",ur:"میں اس اللہ سے معافی مانگتا ہوں جس کے سوا کوئی معبود نہیں، جو ہمیشہ زندہ اور قائم ہے اور اسی کی طرف رجوع کرتا ہوں۔"},
  {c:"پریشانی اور مصیبت کی دعا",ar:"لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",ur:"تیرے سوا کوئی معبود نہیں، تو پاک ہے، بے شک میں ہی قصوروار تھا۔"}
];

export const DuasView: React.FC = () => {
  return (
    <div className="space-y-4 p-4 pb-20 animate-fadeIn">
      <div className="bg-emerald-50 text-emerald-950 p-3.5 text-center space-y-1.5 border border-emerald-100 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold font-amiri leading-normal text-emerald-800">الأدعية المأثورة</h2>
        <p className="text-[11px] text-slate-700 font-urdu leading-relaxed">روزمرہ کی مسنون دعائیں ان کے عربی الفاظ اور اردو ترجمہ کے ساتھ</p>
      </div>

      <div className="space-y-3">
        {IA_DUAS.map((dua, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[9px] text-slate-450 text-slate-400 font-mono font-bold uppercase tracking-wider">Dua {String(i+1).padStart(2, '0')}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 font-bold py-0.5 px-2.5 rounded-lg font-urdu">
                {dua.c}
              </span>
            </div>
            
            <p className="text-base leading-loose font-amiri text-slate-900 text-right" dir="rtl">
              {dua.ar}
            </p>
            <p className="text-xs text-slate-700 leading-relaxed font-urdu text-right border-t border-slate-100 pt-2" dir="rtl">
              {dua.ur}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
