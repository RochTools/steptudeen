import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {

  // ============ IMAM AUTH ============
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    false
  );
  const [authEmail, setAuthEmail] = useState<string>(
    () => localStorage.getItem('imam_email') || ''
  );
  const [authName, setAuthName] = useState<string>(
    () => localStorage.getItem('imam_name') || ''
  );
  const [authUid, setAuthUid] = useState<string>(
    () => localStorage.getItem('imam_uid') || ''
  );

  // ============ USER AUTH ============
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(
    () => localStorage.getItem('user_authenticated') === 'true'
  );
  const [userAuthName, setUserAuthName] = useState<string>(
    () => localStorage.getItem('user_name') || ''
  );
  const [userAuthPhone, setUserAuthPhone] = useState<string>(
    () => localStorage.getItem('user_phone') || ''
  );

  // ============ OTP AUTH ============
  const [isOTPAuthenticated, setIsOTPAuthenticated] = useState<boolean>(
    () => localStorage.getItem('otp_authenticated') === 'true'
  );
  const [otpUserEmail, setOtpUserEmail] = useState<string>(
    () => localStorage.getItem('otp_user_email') || ''
  );
  const [otpUserName, setOtpUserName] = useState<string>(
    () => localStorage.getItem('otp_user_name') || ''
  );

  // ============ LOCAL STORAGE SYNC ============
  useEffect(() => {
    localStorage.setItem('imam_authenticated', String(isAuthenticated));
    localStorage.setItem('imam_email', authEmail);
    localStorage.setItem('imam_name', authName);
    localStorage.setItem('imam_uid', authUid);
  }, [isAuthenticated, authEmail, authName, authUid]);

  useEffect(() => {
    localStorage.setItem('user_authenticated', String(isUserAuthenticated));
    localStorage.setItem('user_name', userAuthName);
    localStorage.setItem('user_phone', userAuthPhone);
  }, [isUserAuthenticated, userAuthName, userAuthPhone]);

  useEffect(() => {
    localStorage.setItem('otp_authenticated', String(isOTPAuthenticated));
    localStorage.setItem('otp_user_email', otpUserEmail);
    localStorage.setItem('otp_user_name', otpUserName);
  }, [isOTPAuthenticated, otpUserEmail, otpUserName]);

  // ============ COMBINED STATE ============
  const isAnyUser = isUserAuthenticated || isOTPAuthenticated;
  const currentUserName = userAuthName || otpUserName;
  const currentUserEmail = userAuthPhone || otpUserEmail;

  // ============ HANDLERS ============
  const handleOTPUserLogin = useCallback((name: string, email: string) => {
    setIsOTPAuthenticated(true);
    setOtpUserEmail(email);
    setOtpUserName(name);
    setIsUserAuthenticated(false);
  }, []);

  const handleUserLogin = useCallback((name: string, phone: string) => {
    if (phone && phone.includes('@')) {
      handleOTPUserLogin(name, phone);
    } else if (phone) {
      setIsUserAuthenticated(true);
      setUserAuthName(name);
      setUserAuthPhone(phone);
      setIsOTPAuthenticated(false);
    } else {
      setIsUserAuthenticated(true);
      setUserAuthName(name);
      setIsOTPAuthenticated(false);
    }
  }, [handleOTPUserLogin]);

  const handleLogoutAll = useCallback(() => {
    setIsAuthenticated(false);
    setIsUserAuthenticated(false);
    setIsOTPAuthenticated(false);
    setAuthEmail('');
    setAuthName('');
    setAuthUid('');
    setUserAuthName('');
    setUserAuthPhone('');
    setOtpUserEmail('');
    setOtpUserName('');

    const keys = [
      'imam_authenticated','imam_email','imam_name','imam_uid',
      'user_authenticated','user_name','user_phone',
      'otp_authenticated','otp_user_email','otp_user_name'
    ];
    keys.forEach(k => localStorage.removeItem(k));
  }, []);

  return {
    // Imam
    isAuthenticated, setIsAuthenticated,
    authEmail, setAuthEmail,
    authName, setAuthName,
    authUid, setAuthUid,
    // User
    isUserAuthenticated, setIsUserAuthenticated,
    userAuthName, setUserAuthName,
    userAuthPhone, setUserAuthPhone,
    // OTP
    isOTPAuthenticated, setIsOTPAuthenticated,
    otpUserEmail, setOtpUserEmail,
    otpUserName, setOtpUserName,
    // Combined
    isAnyUser,
    currentUserName,
    currentUserEmail,
    // Handlers
    handleUserLogin,
    handleOTPUserLogin,
    handleLogoutAll,
  };
};
