import React, { useState, useEffect, useRef } from 'react';
import { Compass, Key, Sparkles, MapPin, RefreshCw, Info } from 'lucide-react';

interface QiblaViewProps {
  userCoords: { latitude: number; longitude: number } | null;
  requestLocation?: () => void;
}

// Coordinates of the holy Kaaba in Makkah, Saudi Arabia
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

export const QiblaView: React.FC<QiblaViewProps> = ({ userCoords, requestLocation }) => {
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number>(262.2); // Pakistan default is ~262°
  const [sensorPermission, setSensorPermission] = useState<string>('unknown');
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [manualRotation, setManualRotation] = useState<number>(0);
  const [isInvertedSensor, setIsInvertedSensor] = useState<boolean>(false);
  const [calibrationOffset, setCalibrationOffset] = useState<number>(() => {
    return Number(localStorage.getItem('qibla_calibration_offset') || '0');
  });
  const hasAbsoluteRef = useRef<boolean>(false);

  const setAndSaveOffset = (val: number) => {
    const normalized = (val + 360) % 360;
    setCalibrationOffset(normalized);
    localStorage.setItem('qibla_calibration_offset', normalized.toString());
  };

  const handleQuickCalibrate = () => {
    // Determine current raw/adjusted heading
    const rawH = deviceHeading !== null ? deviceHeading : manualRotation;
    const adjH = isInvertedSensor ? (360 - rawH) % 360 : rawH;
    const newOffset = (adjH - qiblaAngle + 360) % 360;
    setAndSaveOffset(newOffset);
  };

  const handleResetCalibration = () => {
    setAndSaveOffset(0);
  };

  // Computes the great circle direction (bearing) from user to Makkah
  useEffect(() => {
    if (userCoords) {
      const latRad = userCoords.latitude * Math.PI / 180;
      const lngRad = userCoords.longitude * Math.PI / 180;
      const kaabaLatRad = KAABA_LAT * Math.PI / 180;
      const kaabaLngRad = KAABA_LNG * Math.PI / 180;

      const dLng = kaabaLngRad - lngRad;

      const y = Math.sin(dLng) * Math.cos(kaabaLatRad);
      const x = Math.cos(latRad) * Math.sin(kaabaLatRad) - 
                Math.sin(latRad) * Math.cos(kaabaLatRad) * Math.cos(dLng);

      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      bearing = (bearing + 360) % 360;

      setQiblaAngle(parseFloat(bearing.toFixed(1)));
    } else {
      setQiblaAngle(262.2); // Pakistan Rawalpindi/Islamabad default
    }
  }, [userCoords]);

  // Hook-up actual sensor orientation with dual android/ios support
  useEffect(() => {
    const isIOS = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    
    if (isIOS) {
      setSensorPermission('prompt');
    } else {
      setSensorPermission('android-prompt');
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let heading: number | null = null;
      
      // 1. Check iOS Webkit Compass Heading (True absolute bearing)
      if ((event as any).webkitCompassHeading !== undefined && (event as any).webkitCompassHeading !== null) {
        heading = (event as any).webkitCompassHeading;
        hasAbsoluteRef.current = true;
      } 
      // 2. Check explicitly absolute events (Android deviceorientationabsolute)
      else if (event.type === 'deviceorientationabsolute' || (event as any).absolute === true) {
        if (event.alpha !== null && event.alpha !== undefined) {
        heading = (360 - event.alpha) % 360;
          hasAbsoluteRef.current = true;
        }
      }
      // 3. Fallback standard orientation (Only if no absolute signal was logged yet)
      else if (!hasAbsoluteRef.current && event.alpha !== null && event.alpha !== undefined) {
      heading = (360 - event.alpha) % 360;
      }

      if (heading !== null) {
        const normalized = (heading + 360) % 360;
        setDeviceHeading(normalized);
        setSensorPermission('granted');
      }
    };

    // Store listener on window object for easy sharing across functions
    (window as any).__qiblaHandler = handleOrientation;

    if (!isIOS) {
      if ((window as any).DeviceOrientationEvent) {
        // Android Chromium does not prompt - bind both for maximum speed
        (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
        (window as any).addEventListener('deviceorientation', handleOrientation, true);
      }
    }

    return () => {
      const handler = (window as any).__qiblaHandler;
      if (handler) {
        (window as any).removeEventListener('deviceorientation', handler, true);
        (window as any).removeEventListener('deviceorientationabsolute', handler, true);
      }
    };
  }, []);

  const activateCompass = async () => {
    setIsCalibrating(true);
    const isIOS = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    
    if (isIOS) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setSensorPermission('granted');
          const handler = (window as any).__qiblaHandler;
          if (handler) {
            window.addEventListener('deviceorientation', handler, true);
          }
        } else {
          setSensorPermission('denied');
        }
      } catch (err) {
        console.error('iOS compass permission error:', err);
        setSensorPermission('error');
      }
    } else {
      // Force Android gesture-triggered listener re-binding for absolute sensors.
      const handler = (window as any).__qiblaHandler;
      if (handler) {
        (window as any).removeEventListener('deviceorientationabsolute', handler, true);
        (window as any).removeEventListener('deviceorientation', handler, true);
        
        (window as any).addEventListener('deviceorientationabsolute', handler, true);
        (window as any).addEventListener('deviceorientation', handler, true);
        
        setSensorPermission('granted');
      }
    }

    setTimeout(() => {
      setIsCalibrating(false);
    }, 1200);
  };

  // Determine relative degree to Kaaba based on device/manual heading
  const rawHeading = deviceHeading !== null ? deviceHeading : manualRotation;
  
  // Apply inversion offset if user toggled it
  const adjustedHeading = isInvertedSensor ? (360 - rawHeading) % 360 : rawHeading;
  
  // Apply calibration offset
  const currentHeading = (adjustedHeading - calibrationOffset + 360) % 360;
  
  // Angle user needs to rotate to face the Qibla: (qiblaAngle - currentHeading)
  const relativeAngleToKaaba = (qiblaAngle - currentHeading + 360) % 360;

  // Let's calibrate visually (simulate refreshing sensors)
  const handleRecalibrate = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      setIsCalibrating(false);
      if (requestLocation) requestLocation();
    }, 1200);
  };
  // Is aligned if within 5 degrees
  const isAligned = Math.abs(relativeAngleToKaaba) < 6 || Math.abs(relativeAngleToKaaba - 360) < 6;

  // Custom arrays for rendering realistic geometric ticks on the SVG compass face
  const ticks = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340];
  const cardinalMap: { [key: number]: string } = {
    0: 'N',
    45: 'NE',
    90: 'E',
    135: 'SE',
    180: 'S',
    225: 'SW',
    270: 'W',
    315: 'NW',
  };

  return (
    <div className="absolute inset-x-0 top-[56px] bottom-[56px] flex flex-col items-center justify-center p-4 bg-slate-50 overflow-hidden select-none text-right animate-fadeIn">
      
      {/* Top Banner indicating heading status or permission state */}
      {deviceHeading === null && (
        <button
          type="button"
          onClick={activateCompass}
          className="w-full max-w-sm py-3 px-5 mb-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 active:scale-[0.98] text-white font-bold font-urdu text-[12px] shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-amber-400/50 transition-all text-center animate-pulse shrink-0"
        >
          <Compass size={15} className={isCalibrating ? "animate-spin" : ""} />
          موبائل کا خود کار کمپاس سینسر چالو کریں 🧭
        </button>
      )}

      {/* Main Luxury Premium VIP Card Containing Compass */}
      <div className="w-full max-w-sm relative overflow-hidden bg-gradient-to-b from-[#FAF6E9] via-[#FCF9ED] to-[#F5ECCF] rounded-3xl border-2 border-amber-200/80 p-4 shadow-xl flex flex-col items-center justify-center text-center flex-1 max-h-[460px]">
        
        {/* Luxury Gold/White background decoration rays behind the compass */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl opacity-[0.25]">
          <svg viewBox="0 0 320 320" className="w-full h-full scale-110">
            <circle cx="160" cy="160" r="145" fill="none" stroke="url(#bg-gold-grad)" strokeWidth="0.5" strokeDasharray="3 6" className="opacity-45" />
            <circle cx="160" cy="160" r="115" fill="none" stroke="url(#bg-gold-grad)" strokeWidth="0.5" className="opacity-30" />
            
            {/* 24 radiating lines of Islamic sacred layout */}
            {[...Array(24)].map((_, i) => (
              <line 
                key={`bgl-${i}`}
                x1="160" 
                y1="160" 
                x2={160 + 200 * Math.cos((i * 15 * Math.PI) / 180)} 
                y2={160 + 200 * Math.sin((i * 15 * Math.PI) / 180)} 
                stroke="url(#bg-gold-grad)" 
                strokeWidth="0.4" 
                className="opacity-35"
              />
            ))}
            <defs>
              <linearGradient id="bg-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B7950B" />
                <stop offset="100%" stopColor="#EE9A12" opacity="0.3" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Dynamic VIP Status Direction banner */}
        <div className="relative z-10 w-full mb-5">
          <div className={`py-2 px-5 rounded-full text-[11px] font-bold font-urdu border transition-all duration-300 shadow-sm flex items-center justify-center gap-1.5 ${
            isAligned 
              ? 'bg-[#0b2a6b] text-white border-blue-500 animate-pulse text-[12px] font-black' 
              : 'bg-white/90 text-amber-950 border-amber-200/80 shadow-xs'
          }`}>
            {isAligned ? (
              <span className="flex items-center gap-1.5 justify-center flex-row-reverse">
                <Sparkles size={13} className="text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>● سبحان اللہ! قبلہ شریف کی بالکل ٹھیک سمت</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 justify-center flex-row-reverse font-medium">
                <span>{relativeAngleToKaaba > 180 
                  ? `قبلہ رخ کے لئے فون کو ${Math.round(360 - relativeAngleToKaaba)}° بائیں (Left) گھمائیں`
                  : `قبلہ رخ کے لئے فون کو ${Math.round(relativeAngleToKaaba)}° دائیں (Right) گھمائیں`
                }</span>
              </span>
            )}
          </div>
        </div>

        {/* Visual High-End VIP 3D Gold & Silver Compass Frame */}
        <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center tracking-normal select-none z-10">
          
          <svg viewBox="0 0 300 300" className="w-full h-full select-none pointer-events-none drop-shadow-2xl">
            <defs>
              {/* Luxury Gold Gradients */}
              <linearGradient id="gold-bright" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF9D5" />
                <stop offset="30%" stopColor="#F1C40F" />
                <stop offset="60%" stopColor="#E67E22" />
                <stop offset="85%" stopColor="#D4AC0D" />
                <stop offset="100%" stopColor="#876605" />
              </linearGradient>
              
              <linearGradient id="gold-metal" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F9D460" />
                <stop offset="50%" stopColor="#B7950B" />
                <stop offset="100%" stopColor="#805603" />
              </linearGradient>

              <linearGradient id="gold-shining" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#B7950B" />
                <stop offset="45%" stopColor="#F9E79F" />
                <stop offset="100%" stopColor="#FEFDF9" />
              </linearGradient>

              <linearGradient id="gold-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#B7950B" />
                <stop offset="100%" stopColor="#4A3102" />
              </linearGradient>

              {/* Polished Radial Silver Dial Card */}
              <radialGradient id="silver-face" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="65%" stopColor="#F8F9F9" />
                <stop offset="88%" stopColor="#E5E8E8" />
                <stop offset="100%" stopColor="#BDC3C7" />
              </radialGradient>
              
              {/* Inner bezel shadow */}
              <radialGradient id="ring-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="88%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
              </radialGradient>
            </defs>

            {/* Layered Golden Outer Compass Bezel */}
            <circle cx="150" cy="150" r="144" fill="url(#gold-metal)" />
            <circle cx="150" cy="150" r="141" fill="url(#gold-bright)" />
            <circle cx="150" cy="150" r="132" fill="url(#gold-dark)" />
            <circle cx="150" cy="150" r="130" fill="url(#gold-bright)" />
            
            {/* Fine Inner Circle Ring & Dial Face */}
            <circle cx="150" cy="150" r="124" fill="url(#silver-face)" />
            {/* Shadows inside the golden wall */}
            <circle cx="150" cy="150" r="124" fill="url(#ring-shadow)" />

            {/* ROTATING COMPASS DIAL (N always points physical North) */}
            <g 
              id="rotating-dial-face"
              transform={`rotate(${-currentHeading}, 150, 150)`}
            >
              {/* Fine inner guidelines */}
              <circle cx="150" cy="150" r="111" fill="none" stroke="#B7950B" strokeWidth="0.5" opacity="0.3" />
              <circle cx="150" cy="150" r="88" fill="none" stroke="#B7950B" strokeWidth="0.5" opacity="0.2" />

              {/* Ticks and Degrees (Polar Plotting) */}
              {ticks.map((deg) => {
                const angleRad = ((deg - 90) * Math.PI) / 180;
                const isMajor = deg % 40 === 0;
                
                // Tick line ends
                const x1 = 150 + 121 * Math.cos(angleRad);
                const y1 = 150 + 121 * Math.sin(angleRad);
                const x2 = 150 + (isMajor ? 111 : 115) * Math.cos(angleRad);
                const y2 = 150 + (isMajor ? 111 : 115) * Math.sin(angleRad);
                
                // Numbers
                const xText = 150 + 99 * Math.cos(angleRad);
                const yText = 150 + 99 * Math.sin(angleRad) + 2.5;
                
                return (
                  <g key={`deg-t-${deg}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6E4D03" strokeWidth={isMajor ? 1.4 : 0.7} opacity="0.75" />
                    {deg % 20 === 0 && (
                      <text
                        x={xText}
                        y={yText}
                        fill="#5c1d06"
                        fontSize="7"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                        transform={`rotate(${deg}, ${xText}, ${yText - 2.5})`}
                      >
                        {deg}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Cardinal directions (N, NE, E, SE, S, SW, W, NW) */}
              {Object.entries(cardinalMap).map(([degStr, label]) => {
                const deg = Number(degStr);
                const angleRad = ((deg - 90) * Math.PI) / 180;
                const xText = 150 + 82 * Math.cos(angleRad);
                const yText = 150 + 82 * Math.sin(angleRad) + 3.5;
                const isMajorDir = ['N', 'E', 'S', 'W'].includes(label);

                return (
                  <text
                    key={`label-${label}`}
                    x={xText}
                    y={yText}
                    fill={label === 'N' ? '#C0392B' : '#1A252C'}
                    fontSize={isMajorDir ? '11.5' : '7.5'}
                    fontWeight="black"
                    fontFamily="serif"
                    textAnchor="middle"
                    transform={`rotate(${deg}, ${xText}, ${yText - 3.5})`}
                  >
                    {label}
                  </text>
                );
              })}

              {/* Beautiful luxury compass star inside */}
              <g transform="translate(150, 150)">
                {[0, 90, 180, 270].map((rot) => (
                  <g key={`rose-c-${rot}`} transform={`rotate(${rot})`}>
                    <polygon points="0,0 0,-63 11,-42" fill="url(#gold-shining)" />
                    <polygon points="0,0 0,-63 -11,-42" fill="url(#gold-dark)" />
                  </g>
                ))}
                
                {[45, 135, 225, 315].map((rot) => (
                  <g key={`rose-d-${rot}`} transform={`rotate(${rot}) scale(0.72)`}>
                    <polygon points="0,0 0,-63 10,-42" fill="url(#gold-bright)" opacity="0.9" />
                    <polygon points="0,0 0,-63 -10,-42" fill="#4B2F10" />
                  </g>
                ))}
                
                <circle cx="0" cy="0" r="15" fill="none" stroke="url(#gold-metal)" strokeWidth="0.8" opacity="0.4" />
                <circle cx="0" cy="0" r="4.5" fill="url(#gold-bright)" />
              </g>
            </g>

            {/* DYNAMIC ROTATING ACTIVE LAYERS (Pointer needle & Kaaba emblem rotates to point directly to Qibla relative to phone orientation) */}
            <g 
              id="active-rotating-pointer"
              transform={`rotate(${relativeAngleToKaaba}, 150, 150)`}
            >
              {/* Realistic 3D Bevelled Magnetic Pointer needle showing Qibla directions */}
              <polygon points="150,150 156,132 150,33" fill="url(#gold-shining)" />
              <polygon points="150,150 144,132 150,33" fill="url(#gold-dark)" />
              
              <polygon points="150,150 155,168 150,267" fill="#85929E" />
              <polygon points="150,150 145,168 150,267" fill="#34495E" />
              
              <circle cx="150" cy="150" r="12" fill="url(#gold-metal)" />
              <circle cx="150" cy="150" r="10" fill="url(#gold-bright)" />
              <circle cx="150" cy="150" r="4" fill="#5c1d06" />
              <circle cx="150" cy="150" r="2" fill="#FFFFFF" />

              {/* 🕋 EXQUISITE SEAMLESS KAABA EMBLEM placed at the pointing tip of the rotating needle */}
              <g transform="translate(150, 25) scale(0.95)" className="relative">
                {/* Background Aura Glow */}
                <circle cx="0" cy="0" r="16" fill="#FFFBEB" stroke="url(#gold-bright)" strokeWidth="1.2" className="animate-pulse shadow-xs" />
                
                {/* 3D Model Kaaba Cube */}
                {/* Left Face shadow */}
                <polygon points="0,4.5 -12,-0.5 -12,-13 0,-8" fill="#1C1816" stroke="#000000" strokeWidth="0.3" />
                {/* Right Face shading */}
                <polygon points="0,4.5 12,-0.5 12,-13 0,-8" fill="#38312C" stroke="#000000" strokeWidth="0.3" />
                {/* Top Roof Face */}
                <polygon points="-12,-13 0,-18.5 12,-13 0,-8" fill="#111111" stroke="#000000" strokeWidth="0.3" />
                {/* Golden Kiswah Belt */}
                <polygon points="-12,-8.5 0,-3.5 0,-5.2 -12,-10.2" fill="url(#gold-bright)" />
                <polygon points="12,-8.5 0,-3.5 0,-5.2 12,-10.2" fill="url(#gold-bright)" />
                {/* Golden Bab Al-Kaaba (Door) */}
                <polygon points="2.5,-3.5 8,-6.2 8,-1.5 2.5,1.2" fill="url(#gold-bright)" />
              </g>
            </g>

            {/* STATIC PHONE TOP ALIGNMENT GUIDELINE INDICATOR (Does not rotate, stays at 12 o'clock) */}
            <g transform="translate(150, 11)" className="pointer-events-none select-none z-30">
              <polygon points="0,0 -8,-10 8,-10" fill="url(#gold-bright)" stroke="url(#gold-dark)" strokeWidth="1" />
              <circle cx="0" cy="-15" r="5" fill="#C0392B" className="animate-ping opacity-75" style={{ animationDuration: '3s' }} />
              <circle cx="0" cy="-15" r="3.5" fill="#C0392B" />
            </g>
          </svg>

          {/* Golden/Glass luxury glare filter overlay on top */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none mix-blend-overlay border border-white/10" />
        </div>

        {/* Alignment Success Ring Overlay */}
        {isAligned && (
          <div className="absolute inset-0 bg-[#0b2a6b]/[0.03] pointer-events-none rounded-3xl border-4 border-blue-500/20 animate-pulse z-20" />
        )}

        {/* COMPACT DETAILED STATUS DATA LOGS */}
        <div className="w-full mt-4 relative z-10 border-t border-amber-200/40 pt-3">
          <div className="flex justify-between items-center px-1 text-[10px] text-stone-600 font-urdu">
            <button
              onClick={handleRecalibrate}
              type="button"
              className="px-3 py-1.5 bg-[#0b2a6b] hover:bg-[#1d4ed8] active:scale-95 text-[#FAF6E9] font-bold rounded-xl border border-blue-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs font-urdu text-[9.5px]"
            >
              <RefreshCw size={11} className={`${isCalibrating ? 'animate-spin' : ''}`} />
              لوکیشن اپڈیٹ کریں
            </button>
            <div className="text-right">
              <span className="block font-medium">
                کعبہ کا مستند زاویہ: <strong className="font-mono text-amber-950 font-bold">{qiblaAngle}°</strong>
              </span>
              <span className="text-[9px] text-stone-400 font-mono block">
                {userCoords 
                  ? `${userCoords.latitude.toFixed(4)}°N, ${userCoords.longitude.toFixed(4)}°E` 
                  : 'پاکستان (ڈیفالٹ زاویہ)'
                }
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
