import express, { Router } from 'express';

import { addProduct, addToCart, ecommerce_payment, getAllProduct } from '../controllers/eCommerce.store.controller.js';

const router: Router = express.Router();

router.post('/addToCart', addToCart);

router.get('/getProducts', getAllProduct);

router.post('/add-product', addProduct);

// Alias endpoint to support alternative client integrations
router.post('/save', addProduct);

router.post('/ecommerce_payment', ecommerce_payment);

export default router;
