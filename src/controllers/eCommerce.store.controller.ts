import { Request, Response } from 'express';
import { supabase } from '../helper/supabase.js';

export const getAllProduct = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 9; // Default to 8 items per page
  const store_id = req.query.store_id as string;

  if (!page || !limit) {
    return res.status(400).json({ message: 'Page and limit are required' });
  }

  if (!store_id) {
    return res.status(400).json({ message: 'Store ID is required' });
  }

  try {
    // First, get the total count of products for this store
    const { count, error: countError } = await supabase
      .from('saloon_e_commerce_products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store_id);

    if (countError) throw countError;

    // Calculate offset based on page number
    const offset = (page - 1) * limit;

    // Then fetch the paginated data
    const { data, error } = await supabase
      .from('saloon_e_commerce_products')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1); // -1 because range is inclusive

    if (error) throw error;

    // Calculate total pages
    const totalPages = Math.ceil((count || 0) / limit);

    // Set total count in header
    res.setHeader('X-Total-Count', count?.toString() || '0');

    return res.status(200).json({
      data,
      total: count,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (error) {
    console.log(error, 'error');
    return res.status(500).json({ message: 'Internal server error', error: error });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  const { productId, store_id, price, quantity } = req.body;

  if (!productId || !store_id) {
    return res.status(400).json({ message: 'Product ID and store ID are required' });
  }

  try {
    const { data } = await supabase
      .from('saloon_e_commerce_cart_items')
      .select('*')
      .eq('product_id', productId)
      .eq('store_id', store_id)
      .maybeSingle();

    // If it exists, increment quantity
    if (data) {
      const newQty = (data.quantity ?? 0) + (quantity ? Number(quantity) : 1);
      const { data: updated, error: updateError } = await supabase
        .from('saloon_e_commerce_cart_items')
        .update({ quantity: newQty })
        .eq('id', data.id)
        .select();

      if (updateError) throw updateError;

      return res.status(200).json({
        success: true,
        message: 'Cart quantity updated',
        data: updated,
      });
    }

    // Otherwise insert a new row with quantity default 1 if not provided
    const insertQty = quantity ? Number(quantity) : 1;
    const { data: cartData, error } = await supabase
      .from('saloon_e_commerce_cart_items')
      .insert({
        product_id: productId,
        store_id: store_id,
        quantity: insertQty,
        price_snapshot: price,
      })
      .select();

    if (error) throw error;

    console.log(cartData, 'data after creating the product');

    return res
      .status(200)
      .json({ success: true, message: 'Product added successfully', data: cartData });
  } catch (error) {
    console.log(error, 'error');
    return res.status(500).json({ success: false, message: 'Internal server error', error: error });
  }
};

export async function addProduct(req: Request, res: Response) {
  try {
    let parsed: any = req.body;
    if (parsed && typeof parsed.body === 'string') {
      try {
        parsed = JSON.parse(parsed.body);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON in body.body' });
      }
    } else if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON body string' });
      }
    }

    const body = parsed;
    let products: any[] = [];

    if (Array.isArray(body?.products)) {
      products = body.products;
    } else if (Array.isArray(body)) {
      products = body;
    } else if (body && typeof body === 'object') {
      products = [body];
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: 'Request must include a product object or { products: [...] }' });
    }

    // Generate a simple URL-safe slug from the name
    const toSlug = (name: string) =>
      (name || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    // Derive store_id from payload, query or header (used when client omits per-item store id)
    const incomingStoreId =
      (body?.store_id ??
        body?.storeId ??
        (req.query.store_id as string) ??
        (req.headers['x-store-id'] as string)) ||
      null;

    const nowSuffix = Date.now().toString().slice(-6); // short suffix to avoid slug collisions
    const rows = products.map((p) => {
      const name = (p.name ?? '').toString();
      const baseSlug = toSlug(name);
      const slug = baseSlug ? `${baseSlug}-${nowSuffix}` : `product-${nowSuffix}`;
      return {
        name,
        description: p.description ?? '',
        price: p.price !== undefined && p.price !== null ? Number(p.price) : null,
        image_url: p.image_url ?? p.imageUrl ?? null, // support both keys
        store_id: p.store_id ?? p.storeId ?? incomingStoreId,
        slug, // ensure NOT NULL slug column is satisfied
      };
    });

    const invalid = rows.find((r) => !r.name || r.name.trim() === '');
    if (invalid) {
      return res.status(400).json({ message: 'Each product must include a name' });
    }

    // Validate store_id present for all rows
    const missingStore = rows.find((r) => !r.store_id || `${r.store_id}`.trim() === '');
    if (missingStore) {
      return res.status(400).json({ message: 'store_id is required for each product' });
    }

    // Ensure price is a valid number when provided
    const invalidPrice = rows.find((r) => r.price !== null && Number.isNaN(Number(r.price)));
    if (invalidPrice) {
      return res.status(400).json({ message: 'price must be a valid number' });
    }

    const { error } = await supabase.from('saloon_e_commerce_products').insert(rows);

    if (error) {
      console.log(error, 'addProduct insert error');
      return res.status(500).json({ message: 'Failed to create product(s)', error: error.message });
    }

    return res.status(201).json({ message: 'Product(s) created successfully', success: true });
  } catch (error: any) {
    console.log(error, 'addProduct error');
    return res.status(500).json({ message: 'Internal server error', error, success: false });
  }
}

export async function ecommerce_payment(req: Request, res: Response) {
  const { paymentMethod, amount, store_id, payment_status } = req.body;

  if (!paymentMethod || !store_id) {
    return res.status(400).json({ message: 'Payment method and store_id are required' });
  }

  const finalStatus = payment_status || 'paid';

  try {
    // 0) Compute total from pending cart items for this store
    const { data: pendingItems, error: sumError } = await supabase
      .from('saloon_e_commerce_cart_items')
      .select('quantity, price_snapshot')
      .eq('store_id', store_id)
      .eq('payment_status', 'pending');

    if (sumError) throw sumError;

    const computedTotal = Array.isArray(pendingItems)
      ? pendingItems.reduce((acc: number, it: any) => {
          const qty = Number(it?.quantity ?? 0) || 0;
          const price = Number(it?.price_snapshot ?? 0) || 0;
          return acc + qty * price;
        }, 0)
      : 0;

    const finalAmount = computedTotal > 0 ? computedTotal : Number(amount) || 0;

    // 1) Create order record
    try {
      const { error: orderError } = await supabase.from('saloon_e_commerce_cart_items').insert({
        payment_method: paymentMethod,
        payment_status: finalStatus,
        amount: finalAmount,
        total_amount: finalAmount,
        status: 'done',
        store_id,
      });
      if (orderError) {
        // Log but do not fail entire payment flow if orders table is missing or insert fails
        console.log(orderError, 'ecommerce_payment order insert error');
      }
    } catch (e) {
      console.log(e, 'orders insert unexpected error');
    }

    // 2) Mark all pending cart items for this store as done (no longer pending)
    const { error: updateError } = await supabase
      .from('saloon_e_commerce_cart_items')
      .update({ payment_status: 'done', payment_method: paymentMethod })
      .eq('store_id', store_id)
      .eq('payment_status', 'pending');

    if (updateError) {
      console.log(updateError, 'cart status update error');
      // Not fatal for order creation, but inform client
      return res.status(200).json({
        success: true,
        message: 'Order created, but failed to update some cart items status. Please refresh.',
      });
    }

    return res.status(201).json({
      message: 'Payment processed successfully',
      success: true,
      total_amount: finalAmount,
    });
  } catch (error) {
    console.log(error, 'ecommerce_payment error');
    return res.status(500).json({ message: 'Internal server error', error, success: false });
  }
}
