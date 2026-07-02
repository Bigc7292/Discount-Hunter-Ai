import { db } from '../firebaseConfig';
import {
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export interface RecentSaving {
    id?: string;
    country: string;
    countryFlag: string;
    merchant: string;
    savedAmount: string;
    currency: string;
    timestamp: Timestamp | null;
}

// Collection reference
const COLLECTION_NAME = 'recentSavings';

/**
 * Subscribe to real-time recent savings updates
 * Returns an unsubscribe function
 */
export const subscribeToRecentSavings = (
    callback: (savings: RecentSaving[]) => void,
    maxResults: number = 10
): (() => void) => {
    // If Firestore is not configured, return empty data
    if (!db) {
        console.warn('Firestore not configured - returning empty savings');
        callback([]);
        return () => { }; // Empty unsubscribe function
    }

    const savingsRef = collection(db, COLLECTION_NAME);
    const q = query(
        savingsRef,
        orderBy('timestamp', 'desc'),
        limit(maxResults)
    );

    const loadSavings = async () => {
        try {
            const snapshot = await getDocs(q);
            const savings: RecentSaving[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RecentSaving));
            callback(savings);
        } catch (error) {
            console.info('Recent savings feed unavailable:', error);
            callback([]);
        }
    };

    void loadSavings();

    return () => { };
};

/**
 * Log a successful code usage to Firestore
 * This will appear in the LiveTicker
 */
export const logSuccessfulSaving = async (
    merchant: string,
    savedAmount: number,
    currency: string = 'USD',
    countryCode: string = 'US'
): Promise<void> => {
    if (!db) {
        console.warn('Firestore not configured - cannot log saving');
        return;
    }

    const countryFlags: Record<string, string> = {
        'US': '🇺🇸',
        'GB': '🇬🇧',
        'DE': '🇩🇪',
        'FR': '🇫🇷',
        'JP': '🇯🇵',
        'CA': '🇨🇦',
        'AU': '🇦🇺',
        'AE': '🇦🇪',
        'GLOBAL': '🌍'
    };

    const currencySymbols: Record<string, string> = {
        'USD': '$',
        'GBP': '£',
        'EUR': '€',
        'JPY': '¥',
        'AED': 'د.إ',
        'CAD': 'C$',
        'AUD': 'A$'
    };

    try {
        const savingsRef = collection(db, COLLECTION_NAME);
        await addDoc(savingsRef, {
            country: countryCode,
            countryFlag: countryFlags[countryCode] || '🌍',
            merchant: merchant.toUpperCase(),
            savedAmount: `${currencySymbols[currency] || '$'}${savedAmount.toFixed(2)}`,
            currency: currency,
            timestamp: serverTimestamp()
        });
        console.log(`✅ Logged saving: ${merchant} - ${savedAmount} ${currency}`);
    } catch (error) {
        console.error('Failed to log saving:', error);
    }
};

/**
 * Format a RecentSaving for display in the LiveTicker
 */
export const formatSavingForTicker = (saving: RecentSaving): string => {
    return `${saving.countryFlag} TARGET: ${saving.merchant} -> SAVED ${saving.savedAmount}`;
};

/**
 * Get placeholder data to show when no real data exists yet
 */
export const getPlaceholderSavings = (): RecentSaving[] => {
    return [
        { countryFlag: '🔄', country: 'GLOBAL', merchant: 'WAITING FOR DATA', savedAmount: '...', currency: 'USD', timestamp: null },
    ];
};
