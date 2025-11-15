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

    console.log(!data, 'data');

    if (data) {
      return res.status(400).json({ message: 'Product already in cart' });
    }

    const { data: cartData, error } = await supabase
      .from('saloon_e_commerce_cart_items')
      .insert({
        product_id: productId,
        store_id: store_id,
        quantity: quantity,
        price_snapshot: price,
      })
      .select();

    if (error) throw error;

    console.log(cartData, 'data after creating the product');

    return res.status(200).json({ message: 'Product added successfully', data: cartData });
  } catch (error) {
    console.log(error, 'error');
    return res.status(500).json({ message: 'Internal server error', error: error });
  }
};

export async function addProduct(req: Request, res: Response) {
  try {
    const body = req.body;
    let products: any[] = [];

    if (Array.isArray(body?.products)) {
      products = body.products;
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

    // Map to DB columns used elsewhere in this codebase
    // Table: saloon_e_commerce_products
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
        store_id: p.store_id ?? p.storeId ?? null,
        slug, // ensure NOT NULL slug column is satisfied
      };
    });

    // Basic validation: require name
    const invalid = rows.find((r) => !r.name || r.name.trim() === '');
    if (invalid) {
      return res.status(400).json({ message: 'Each product must include a name' });
    }

    const { data, error } = await supabase
      .from('saloon_e_commerce_products')
      .insert(rows)
      .select('*');

    if (error) {
      console.log(error, 'addProduct insert error');
      return res.status(500).json({ message: 'Failed to create product(s)', error: error.message });
    }

    return res.status(201).json({ message: 'Product(s) created successfully', data });
  } catch (error: any) {
    console.log(error, 'addProduct error');
    return res.status(500).json({ message: 'Internal server error', error });
  }
}
