import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';

export interface PriceHistoryEntry {
  price: number;
  date: string;
  source: string;
}

export interface WishlistItem {
  id: string;
  dealId?: string;
  name: string;
  brand: string;
  category: string;
  currentPrice: number;
  originalPrice: number;
  targetPrice?: number;
  priceHistory: PriceHistoryEntry[];
  imageUrl?: string;
  productUrl?: string;
  source: string;
  currencySymbol: string;
  currencyCode: string;
  addedAt: string;
  lastChecked: string;
  isOnSale: boolean;
  priceDropPercent: number;
  notifyOnSale: boolean;
  notifyAtTargetPrice: boolean;
  gender: 'male' | 'female' | 'unisex';
}

export interface PriceAlert {
  id: string;
  itemId: string;
  itemName: string;
  brand: string;
  previousPrice: number;
  newPrice: number;
  dropPercent: number;
  currencySymbol: string;
  timestamp: string;
  isRead: boolean;
  type: 'price_drop' | 'target_reached' | 'back_in_stock' | 'limited_time';
}

export interface SearchProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  retailer: string;
  matchScore: number;
  stylistNotes?: string;
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  priceAlerts: PriceAlert[];
  unreadAlertsCount: number;
  isLoading: boolean;
  isSearching: boolean;
  searchResults: SearchProduct[];
  addToWishlist: (item: Omit<WishlistItem, 'id' | 'addedAt' | 'lastChecked' | 'priceHistory' | 'isOnSale' | 'priceDropPercent'>) => Promise<void>;
  addProductToWishlist: (product: SearchProduct) => Promise<void>;
  addItemByUrl: (productUrl: string) => Promise<{ success: boolean; itemName?: string; error?: string }>;
  removeFromWishlist: (itemId: string) => Promise<void>;
  stopPriceTracking: (itemId: string) => Promise<void>;
  markAsPurchased: (itemId: string) => Promise<void>;
  isInWishlist: (itemId: string) => boolean;
  updateTargetPrice: (itemId: string, targetPrice: number | undefined) => Promise<void>;
  toggleSaleNotification: (itemId: string) => Promise<void>;
  toggleTargetPriceNotification: (itemId: string) => Promise<void>;
  markAlertAsRead: (alertId: string) => Promise<void>;
  markAllAlertsAsRead: () => Promise<void>;
  clearAlerts: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  searchProducts: (query: string, limit?: number) => Promise<SearchProduct[]>;
  clearSearchResults: () => void;
  getItemsByCategory: (category: string) => WishlistItem[];
  getOnSaleItems: () => WishlistItem[];
  getTotalSavings: () => number;
  syncWithBackend: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

const WISHLIST_STORAGE_KEY = '@dripn_wishlist';
const ALERTS_STORAGE_KEY = '@dripn_price_alerts';

const SAMPLE_CATEGORIES = ['All', 'Clothing', 'Footwear', 'Accessories', 'Luxury', 'Athleisure'];

function generateMockPriceHistory(originalPrice: number, currentPrice: number): PriceHistoryEntry[] {
  const history: PriceHistoryEntry[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const variance = (Math.random() - 0.5) * 0.1;
    const interpolated = originalPrice - ((originalPrice - currentPrice) * ((6 - i) / 6));
    const price = Math.max(currentPrice, Math.round((interpolated + interpolated * variance) * 100) / 100);
    
    history.push({
      price,
      date: date.toISOString(),
      source: 'Price Tracker',
    });
  }
  
  return history;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadWishlistData();
    } else {
      setWishlistItems([]);
      setPriceAlerts([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const loadWishlistData = async () => {
    setIsLoading(true);
    try {
      // Try to load from backend first
      try {
        const [trackingResponse, alertsResponse] = await Promise.all([
          apiService.getPriceTrackedItems(),
          apiService.getPriceAlerts(),
        ]);

        if (trackingResponse?.items) {
          const backendItems: WishlistItem[] = trackingResponse.items.map(item => ({
            id: item.id,
            name: item.productName,
            brand: item.retailerName,
            category: 'Tracked',
            currentPrice: item.currentPrice,
            originalPrice: item.originalPrice,
            targetPrice: item.targetPrice,
            priceHistory: [],
            imageUrl: item.imageUrl,
            productUrl: item.productUrl,
            source: item.retailerName,
            currencySymbol: item.currency === 'GBP' ? '£' : '$',
            currencyCode: item.currency || 'GBP',
            addedAt: item.lastChecked,
            lastChecked: item.lastChecked,
            isOnSale: item.isOnSale,
            priceDropPercent: item.priceDropPercent,
            notifyOnSale: true,
            notifyAtTargetPrice: !!item.targetPrice,
            gender: 'unisex',
          }));
          setWishlistItems(backendItems);
        }

        if (alertsResponse?.alerts) {
          setPriceAlerts(alertsResponse.alerts);
        }
        
        return;
      } catch (backendErr) {
        console.log('Backend not available, using local storage');
      }

      // Fallback to local storage
      const [wishlistData, alertsData] = await Promise.all([
        AsyncStorage.getItem(`${WISHLIST_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${ALERTS_STORAGE_KEY}_${user?.id}`),
      ]);

      if (wishlistData) {
        setWishlistItems(JSON.parse(wishlistData));
      }
      if (alertsData) {
        setPriceAlerts(JSON.parse(alertsData));
      }
    } catch (err) {
      console.error('Failed to load wishlist data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWishlistItems = async (items: WishlistItem[]) => {
    try {
      await AsyncStorage.setItem(
        `${WISHLIST_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(items)
      );
    } catch (err) {
      console.error('Failed to save wishlist:', err);
    }
  };

  const saveAlerts = async (alerts: PriceAlert[]) => {
    try {
      await AsyncStorage.setItem(
        `${ALERTS_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(alerts)
      );
    } catch (err) {
      console.error('Failed to save alerts:', err);
    }
  };

  const addToWishlist = useCallback(async (item: Omit<WishlistItem, 'id' | 'addedAt' | 'lastChecked' | 'priceHistory' | 'isOnSale' | 'priceDropPercent'>) => {
    if (item.dealId) {
      const isDuplicate = wishlistItems.some(existing => 
        existing.dealId === item.dealId || existing.productUrl === item.dealId
      );
      if (isDuplicate) {
        return;
      }
    }
    
    const now = new Date().toISOString();
    const priceDropPercent = item.originalPrice > 0 
      ? Math.round(((item.originalPrice - item.currentPrice) / item.originalPrice) * 100)
      : 0;
    
    const newItem: WishlistItem = {
      ...item,
      id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      addedAt: now,
      lastChecked: now,
      priceHistory: generateMockPriceHistory(item.originalPrice, item.currentPrice),
      isOnSale: item.currentPrice < item.originalPrice,
      priceDropPercent,
    };

    const updatedItems = [newItem, ...wishlistItems];
    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);
  }, [wishlistItems, user?.id]);

  const addItemByUrl = useCallback(async (productUrl: string): Promise<{ success: boolean; itemName?: string; error?: string }> => {
    try {
      const response = await apiService.addPriceTracking(productUrl);
      if (response?.success && response.item) {
        // Refresh the wishlist to include the new item
        await loadWishlistData();
        return { success: true, itemName: response.item.productName };
      }
      return { success: false, error: 'Failed to add item' };
    } catch (err: any) {
      console.error('Failed to add item by URL:', err);
      return { success: false, error: err.message || 'Failed to track product' };
    }
  }, []);

  const removeFromWishlist = useCallback(async (itemId: string) => {
    const updatedItems = wishlistItems.filter(item => item.id !== itemId);
    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);
    
    // Also stop price tracking on backend
    try {
      await apiService.stopPriceTracking(itemId);
    } catch (error) {
      console.log('[Wishlist] Failed to stop price tracking on backend:', error);
    }
  }, [wishlistItems, user?.id]);

  const stopPriceTracking = useCallback(async (itemId: string) => {
    try {
      await apiService.stopPriceTracking(itemId);
      // Remove from local list
      const updatedItems = wishlistItems.filter(item => item.id !== itemId);
      setWishlistItems(updatedItems);
      await saveWishlistItems(updatedItems);
    } catch (error) {
      console.log('[Wishlist] Failed to stop price tracking:', error);
      throw error;
    }
  }, [wishlistItems, user?.id]);

  const isInWishlist = useCallback((itemId: string) => {
    return wishlistItems.some(item => item.id === itemId);
  }, [wishlistItems]);

  const updateTargetPrice = useCallback(async (itemId: string, targetPrice: number | undefined) => {
    // Update backend first if possible
    if (targetPrice !== undefined) {
      try {
        await apiService.setTargetPrice(itemId, targetPrice);
      } catch (err) {
        console.log('Backend not available for target price update');
      }
    }
    
    const updatedItems = wishlistItems.map(item =>
      item.id === itemId ? { ...item, targetPrice } : item
    );
    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);
  }, [wishlistItems, user?.id]);

  const toggleSaleNotification = useCallback(async (itemId: string) => {
    const updatedItems = wishlistItems.map(item =>
      item.id === itemId ? { ...item, notifyOnSale: !item.notifyOnSale } : item
    );
    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);
  }, [wishlistItems, user?.id]);

  const toggleTargetPriceNotification = useCallback(async (itemId: string) => {
    const updatedItems = wishlistItems.map(item =>
      item.id === itemId ? { ...item, notifyAtTargetPrice: !item.notifyAtTargetPrice } : item
    );
    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);
  }, [wishlistItems, user?.id]);

  const markAlertAsRead = useCallback(async (alertId: string) => {
    // Mark as read on backend
    try {
      await apiService.markPriceAlertsRead([alertId]);
    } catch (err) {
      console.log('Backend not available for marking alert as read');
    }
    
    const updatedAlerts = priceAlerts.map(alert =>
      alert.id === alertId ? { ...alert, isRead: true } : alert
    );
    setPriceAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);
  }, [priceAlerts, user?.id]);

  const markAllAlertsAsRead = useCallback(async () => {
    // Mark all as read on backend
    try {
      await apiService.markPriceAlertsRead();
    } catch (err) {
      console.log('Backend not available for marking alerts as read');
    }
    
    const updatedAlerts = priceAlerts.map(alert => ({ ...alert, isRead: true }));
    setPriceAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);
  }, [priceAlerts, user?.id]);

  const clearAlerts = useCallback(async () => {
    setPriceAlerts([]);
    await saveAlerts([]);
  }, [user?.id]);

  const refreshPrices = useCallback(async () => {
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const updatedItems = wishlistItems.map(item => {
      const priceChange = (Math.random() - 0.6) * 0.15;
      const newPrice = Math.round(item.currentPrice * (1 + priceChange) * 100) / 100;
      const clampedPrice = Math.max(item.currentPrice * 0.7, Math.min(item.originalPrice, newPrice));
      
      const newPriceDropPercent = item.originalPrice > 0
        ? Math.round(((item.originalPrice - clampedPrice) / item.originalPrice) * 100)
        : 0;
      
      const newHistory: PriceHistoryEntry = {
        price: clampedPrice,
        date: new Date().toISOString(),
        source: 'Price Tracker',
      };
      
      return {
        ...item,
        currentPrice: clampedPrice,
        priceHistory: [...item.priceHistory.slice(-6), newHistory],
        lastChecked: new Date().toISOString(),
        isOnSale: clampedPrice < item.originalPrice,
        priceDropPercent: newPriceDropPercent,
      };
    });

    const newAlerts: PriceAlert[] = [];
    updatedItems.forEach((item, index) => {
      const oldItem = wishlistItems[index];
      if (oldItem && item.currentPrice < oldItem.currentPrice) {
        const dropPercent = Math.round(((oldItem.currentPrice - item.currentPrice) / oldItem.currentPrice) * 100);
        if (dropPercent >= 5 && item.notifyOnSale) {
          newAlerts.push({
            id: `alert_${Date.now()}_${index}`,
            itemId: item.id,
            itemName: item.name,
            brand: item.brand,
            previousPrice: oldItem.currentPrice,
            newPrice: item.currentPrice,
            dropPercent,
            currencySymbol: item.currencySymbol,
            timestamp: new Date().toISOString(),
            isRead: false,
            type: 'price_drop',
          });
        }
        
        if (item.targetPrice && item.currentPrice <= item.targetPrice && item.notifyAtTargetPrice) {
          newAlerts.push({
            id: `alert_target_${Date.now()}_${index}`,
            itemId: item.id,
            itemName: item.name,
            brand: item.brand,
            previousPrice: oldItem.currentPrice,
            newPrice: item.currentPrice,
            dropPercent,
            currencySymbol: item.currencySymbol,
            timestamp: new Date().toISOString(),
            isRead: false,
            type: 'target_reached',
          });
        }
      }
    });

    setWishlistItems(updatedItems);
    await saveWishlistItems(updatedItems);

    if (newAlerts.length > 0) {
      const allAlerts = [...newAlerts, ...priceAlerts];
      setPriceAlerts(allAlerts);
      await saveAlerts(allAlerts);
    }

    setIsLoading(false);
  }, [wishlistItems, priceAlerts, user?.id]);

  const getItemsByCategory = useCallback((category: string) => {
    if (category === 'All') return wishlistItems;
    return wishlistItems.filter(item => item.category === category);
  }, [wishlistItems]);

  const getOnSaleItems = useCallback(() => {
    return wishlistItems.filter(item => item.isOnSale);
  }, [wishlistItems]);

  const getTotalSavings = useCallback(() => {
    return wishlistItems.reduce((total, item) => {
      if (item.isOnSale) {
        return total + (item.originalPrice - item.currentPrice);
      }
      return total;
    }, 0);
  }, [wishlistItems]);

  const searchProducts = useCallback(async (query: string, limit: number = 5): Promise<SearchProduct[]> => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }
    
    setIsSearching(true);
    try {
      const response = await apiService.searchProducts(query, limit);
      setSearchResults(response.products);
      return response.products;
    } catch (error) {
      console.error('Product search failed:', error);
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const addProductToWishlist = useCallback(async (product: SearchProduct) => {
    try {
      await apiService.addToWishlist({
        productName: product.name,
        retailerId: product.retailer,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        affiliateUrl: product.affiliateUrl,
      });
      
      const now = new Date().toISOString();
      const newItem: WishlistItem = {
        id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        dealId: product.id,
        name: product.name,
        brand: product.retailer,
        category: 'Clothing',
        currentPrice: product.price,
        originalPrice: product.price,
        priceHistory: [{ price: product.price, date: now, source: product.retailer }],
        imageUrl: product.imageUrl,
        productUrl: product.affiliateUrl,
        source: product.retailer,
        currencySymbol: product.currency === 'GBP' ? '£' : '$',
        currencyCode: product.currency,
        addedAt: now,
        lastChecked: now,
        isOnSale: false,
        priceDropPercent: 0,
        notifyOnSale: true,
        notifyAtTargetPrice: false,
        gender: 'unisex',
      };
      
      const updatedItems = [newItem, ...wishlistItems];
      setWishlistItems(updatedItems);
      await saveWishlistItems(updatedItems);
    } catch (error) {
      console.error('Failed to add product to wishlist:', error);
      throw error;
    }
  }, [wishlistItems, user?.id]);

  const markAsPurchased = useCallback(async (itemId: string) => {
    try {
      await apiService.markWishlistItemPurchased(itemId);
      const updatedItems = wishlistItems.filter(item => item.id !== itemId);
      setWishlistItems(updatedItems);
      await saveWishlistItems(updatedItems);
    } catch (error) {
      console.error('Failed to mark as purchased:', error);
      throw error;
    }
  }, [wishlistItems, user?.id]);

  const syncWithBackend = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    
    setIsLoading(true);
    try {
      const response = await apiService.getWishlist();
      const backendItems: WishlistItem[] = response.items.map(item => ({
        id: item.id,
        dealId: item.id,
        name: item.productName,
        brand: item.retailerName || item.retailerId,
        category: 'Clothing',
        currentPrice: item.price,
        originalPrice: item.price,
        priceHistory: [{ price: item.price, date: item.createdAt, source: item.retailerName || item.retailerId }],
        imageUrl: item.imageUrl,
        productUrl: item.affiliateUrl,
        source: item.retailerName || item.retailerId,
        currencySymbol: item.currency === 'GBP' ? '£' : '$',
        currencyCode: item.currency,
        addedAt: item.createdAt,
        lastChecked: item.createdAt,
        isOnSale: false,
        priceDropPercent: 0,
        notifyOnSale: true,
        notifyAtTargetPrice: false,
        gender: 'unisex' as const,
      }));
      
      setWishlistItems(backendItems);
      await saveWishlistItems(backendItems);
    } catch (error) {
      console.error('Failed to sync with backend:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const unreadAlertsCount = priceAlerts.filter(alert => !alert.isRead).length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        priceAlerts,
        unreadAlertsCount,
        isLoading,
        isSearching,
        searchResults,
        addToWishlist,
        addProductToWishlist,
        addItemByUrl,
        removeFromWishlist,
        stopPriceTracking,
        markAsPurchased,
        isInWishlist,
        updateTargetPrice,
        toggleSaleNotification,
        toggleTargetPriceNotification,
        markAlertAsRead,
        markAllAlertsAsRead,
        clearAlerts,
        refreshPrices,
        searchProducts,
        clearSearchResults,
        getItemsByCategory,
        getOnSaleItems,
        getTotalSavings,
        syncWithBackend,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

export { SAMPLE_CATEGORIES };
