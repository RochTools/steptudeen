import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ChevronRight, X, Calendar } from 'lucide-react';

// ─── Firebase ────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBq0NdPA2pC3C-qd4RVuc89VP8c28Qu2PA",
  authDomain: "steptudeen-review.firebaseapp.com",
  projectId: "steptudeen-review",
  storageBucket: "steptudeen-review.firebasestorage.app",
  messagingSenderId: "764770905404",
  appId: "1:764770905404:web:11a4be8da48ce471b58239"
};

const app = initializeApp(firebaseConfig, 'rating-app');
const db = getFirestore(app);

// ─── Types ──────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: any;
}

// ─── Helper functions (OUTSIDE component so ReviewCard can use them) ─────────
function getReviewTime(r: Review): Date {
  if (r.createdAt?.toDate) return r.createdAt.toDate();
  if (r.createdAt?.seconds) return new Date(r.createdAt.seconds * 1000);
  return new Date();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getInitial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '★' : '') + '☆'.repeat(empty);
}

// ─── Review Card Component ──────────────────────────────────────────────────
function ReviewCard({ review }: { review: Review }) {
  const date = getReviewTime(review);
  const initial = getInitial(review.name);
  const stars = renderStars(Math.round(review.rating || 0));

  return (
    <div style={styles.reviewCard}>
      <div style={styles.reviewTop}>
        <span style={styles.reviewAuthor}>
          <span style={styles.avatar}>{initial}</span>
          {review.name}
        </span>
        <span style={styles.reviewStars}>{stars}</span>
      </div>
      <div style={styles.reviewDate}>
        <Calendar size={12} style={styles.reviewDateIcon} />
        {formatDate(date)}
      </div>
      <div style={styles.reviewComment}>{review.comment}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function RatingApp({ onBack }: { onBack?: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formName, setFormName] = useState('');
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // ─── Load Reviews ──────────────────────────────────────────────────────────
  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      let snap;
      try {
        const q = query(collection(db, 'reviews'), where('approved', '==', true));
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, 'reviews'));
      }

      const data: Review[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.approved === true || d.approved === 'true' || d.approved === 1 || d.approved === '1') {
          data.push({ id: doc.id, ...d } as Review);
        }
      });

      data.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds || 0) * 1000;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds || 0) * 1000;
        return tb - ta;
      });

      setReviews(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load reviews. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  // ─── Submit Review ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    if (selectedRating === 0) {
      setFormMessage({ type: 'error', text: 'Please select at least 1 star.' });
      return;
    }
    if (!formName.trim()) {
      setFormMessage({ type: 'error', text: 'Name is required.' });
      return;
    }
    if (!formComment.trim()) {
      setFormMessage({ type: 'error', text: 'Please share a short comment.' });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        name: formName.trim(),
        rating: selectedRating,
        comment: formComment.trim(),
        approved: false,
        createdAt: serverTimestamp()
      });

      setFormMessage({
        type: 'success',
        text: 'Jazāk Allāh Khayr! Your review has been received. It will appear after approval.'
      });
      setFormName('');
      setFormComment('');
      setSelectedRating(0);
      setHoverRating(0);

      setTimeout(loadReviews, 2000);
    } catch (err) {
      console.error(err);
      setFormMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews)
    : 0;
  const avgDisplay = avgRating > 0 ? avgRating.toFixed(1) : '—';
  const avgStars = avgRating > 0 ? renderStars(Math.round(avgRating)) : '☆☆☆☆☆';

  const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    const rating = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
    starCounts[rating as keyof typeof starCounts]++;
  });

  const getBarPercent = (stars: number) =>
    totalReviews > 0 ? Math.round((starCounts[stars as keyof typeof starCounts] / totalReviews) * 100) : 0;

  const previewReviews = reviews.slice(0, 3);
  const hasMore = reviews.length > 3;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* Back Button */}
      {onBack && (
        <button onClick={onBack} style={styles.backBtn}>
          ← Back
        </button>
      )}

      {/* Rating Hero */}
      <div style={styles.heroCard}>
        <div style={styles.heroLeft}>
          <div style={styles.avgNumber}>{avgDisplay}</div>
          <div style={styles.avgStars}>{avgStars}</div>
          <div style={styles.avgCount}>
            {totalReviews === 0 ? 'No reviews yet' : `${totalReviews} review${totalReviews === 1 ? '' : 's'}`}
          </div>
        </div>

        <div style={styles.heroRight}>
          {[5, 4, 3, 2, 1].map((num) => (
            <div key={num} style={styles.barRow}>
              <span style={styles.barLabel}>{num}</span>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${getBarPercent(num)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Write Review Form */}
      <div ref={formRef} style={styles.formCard}>
        <h3 style={styles.formTitle}>Write your review</h3>
        <p style={styles.formHint}>Honest feedback helps the whole community.</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.starSelector}>
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                style={{
                  ...styles.starBtn,
                  color: (hoverRating || selectedRating) >= num ? '#c9a24b' : '#d1d5db',
                }}
                onMouseEnter={() => setHoverRating(num)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setSelectedRating(num)}
              >
                ★
              </button>
            ))}
          </div>

          <input
            type="text"
            style={styles.input}
            placeholder="Your name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            maxLength={60}
          />

          <textarea
            style={{ ...styles.input, ...styles.textarea }}
            placeholder="How does our performance feel to you? Share your experience…"
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            maxLength={500}
            rows={4}
          />

          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            <Send size={16} />
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>

          {formMessage && (
            <div style={{
              ...styles.formMsg,
              ...(formMessage.type === 'success' ? styles.formMsgSuccess : styles.formMsgError),
            }}>
              {formMessage.text}
            </div>
          )}
        </form>
      </div>

      {/* Reviews List */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <MessageSquare size={18} style={styles.listIcon} />
          <h3 style={styles.listTitle}>Community feedback</h3>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading reviews…</div>
        ) : error ? (
          <div style={styles.errorBox}>
            <p>{error}</p>
            <button style={styles.retryBtn} onClick={loadReviews}>Try again</button>
          </div>
        ) : reviews.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={styles.emptyIcon}>💬</div>
            <h4 style={styles.emptyTitle}>No reviews yet</h4>
            <p style={styles.emptyText}>Be the first to share your experience!</p>
          </div>
        ) : (
          <>
            {previewReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {hasMore && (
              <button style={styles.readMoreBtn} onClick={() => setShowAllReviews(true)}>
                Read more · {reviews.length - 3} more review{reviews.length - 3 === 1 ? '' : 's'}
                <ChevronRight size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Full Reviews Modal */}
      {showAllReviews && (
        <div style={styles.modalOverlay} onClick={() => setShowAllReviews(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>All Reviews</h3>
              <button style={styles.modalClose} onClick={() => setShowAllReviews(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalSummary}>
              <span style={styles.modalAvg}>{avgDisplay}</span>
              <span style={styles.modalStars}>{avgStars}</span>
              <span style={styles.modalCount}>{totalReviews} reviews</span>
            </div>

            <div style={styles.modalList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px 16px 48px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#0b1f4d',
    background: '#f8fafc',
    minHeight: '100vh',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    marginBottom: '16px',
    padding: '4px 0',
  },
  heroCard: {
    background: '#ffffff',
    border: '1px solid #e7e7e2',
    borderRadius: '18px',
    padding: '20px',
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '16px',
    boxShadow: '0 2px 10px rgba(37,99,235,0.05)',
    marginBottom: '16px',
  },
  heroLeft: {
    textAlign: 'center' as const,
    paddingRight: '16px',
    borderRight: '1px solid #e7e7e2',
  },
  avgNumber: {
    fontFamily: 'Georgia, serif',
    fontSize: '2.6rem',
    fontWeight: 700,
    color: '#0b1f4d',
    lineHeight: 1,
  },
  avgStars: {
    fontSize: '1.1rem',
    letterSpacing: '2px',
    color: '#c9a24b',
    margin: '6px 0 4px',
  },
  avgCount: {
    fontSize: '0.8rem',
    color: '#4b615c',
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    justifyContent: 'center',
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  barLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#4b615c',
    width: '14px',
    textAlign: 'right' as const,
  },
  barTrack: {
    flex: 1,
    height: '8px',
    background: '#eef2f0',
    borderRadius: '100px',
    overflow: 'hidden' as const,
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #c9a24b, #e0bc5a)',
    borderRadius: '100px',
    transition: 'width 0.6s ease',
  },
  formCard: {
    background: '#ffffff',
    border: '1px solid #e7e7e2',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(37,99,235,0.05)',
    marginBottom: '16px',
  },
  formTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: '0 0 4px',
    fontFamily: 'Georgia, serif',
    color: '#0b1f4d',
  },
  formHint: {
    fontSize: '0.85rem',
    color: '#4b615c',
    margin: '0 0 16px',
  },
  starSelector: {
    display: 'flex',
    gap: '6px',
    marginBottom: '14px',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.15s, transform 0.1s',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid #e7e7e2',
    borderRadius: '12px',
    fontSize: '0.9rem',
    color: '#0b1f4d',
    background: '#ffffff',
    marginBottom: '12px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    resize: 'vertical' as const,
    minHeight: '100px',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '100px',
    padding: '12px 28px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s',
    boxShadow: '0 4px 14px rgba(37,99,235,0.22)',
  },
  formMsg: {
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    marginTop: '12px',
    lineHeight: 1.5,
  },
  formMsgSuccess: {
    background: '#d1fae5',
    color: '#1d4ed8',
    border: '1px solid #a7f3d0',
  },
  formMsgError: {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  listCard: {
    background: '#ffffff',
    border: '1px solid #e7e7e2',
    borderRadius: '18px',
    padding: '18px 20px',
    boxShadow: '0 2px 10px rgba(37,99,235,0.05)',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  listIcon: { color: '#c9a24b' },
  listTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
    fontFamily: 'Georgia, serif',
    color: '#0b1f4d',
  },
  reviewCard: {
    padding: '16px 0',
    borderBottom: '1px solid #e7e7e2',
  },
  reviewTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  reviewAuthor: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: '#0b1f4d',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#e7f0ec',
    color: '#2563eb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 800,
  },
  reviewStars: {
    color: '#c9a24b',
    fontSize: '0.9rem',
    letterSpacing: '1px',
  },
  reviewDate: {
    fontSize: '0.75rem',
    color: '#4b615c',
    marginLeft: '35px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  reviewDateIcon: { marginRight: '2px' },
  reviewComment: {
    fontSize: '0.88rem',
    color: '#4b615c',
    lineHeight: 1.6,
    marginTop: '6px',
    marginLeft: '35px',
  },
  readMoreBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: '#e7f0ec',
    color: '#1d4ed8',
    border: '1.5px solid #c5d4cf',
    borderRadius: '100px',
    padding: '10px 22px',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '12px',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '24px',
    color: '#4b615c',
    fontSize: '0.9rem',
  },
  errorBox: {
    textAlign: 'center' as const,
    padding: '24px',
    color: '#991b1b',
  },
  retryBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '100px',
    padding: '8px 20px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  emptyBox: {
    textAlign: 'center' as const,
    padding: '28px 16px',
  },
  emptyIcon: { fontSize: '2rem', marginBottom: '8px' },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: '0 0 4px',
    fontFamily: 'Georgia, serif',
    color: '#0b1f4d',
  },
  emptyText: { fontSize: '0.9rem', color: '#4b615c', margin: 0 },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(21, 38, 35, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '20px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto' as const,
    padding: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    margin: 0,
    fontFamily: 'Georgia, serif',
    color: '#0b1f4d',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#4b615c',
    padding: '4px',
  },
  modalSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  modalAvg: {
    fontSize: '1.4rem',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
    color: '#0b1f4d',
  },
  modalStars: {
    fontSize: '0.95rem',
    color: '#c9a24b',
    letterSpacing: '2px',
  },
  modalCount: {
    fontSize: '0.8rem',
    color: '#4b615c',
    marginLeft: 'auto',
  },
  modalList: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
};
