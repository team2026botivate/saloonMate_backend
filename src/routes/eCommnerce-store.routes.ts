import express, { Router } from 'express';

import { addProduct, addToCart, getAllProduct } from '../controllers/eCommerce.store.controller.js';

const router: Router = express.Router();

router.post('/addToCart', addToCart);

router.get('/getProducts', getAllProduct);

router.post('/add-product', addProduct);

// Alias endpoint to support alternative client integrations
router.post('/save', addProduct);

export default router;
