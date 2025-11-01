import express, { Router } from 'express';

import { addToCart, getAllProduct } from '../controllers/eCommerce.store.controller.js';

const router: Router = express.Router();

router.post('/addToCart', addToCart);

router.get('/getProducts', getAllProduct);

export default router;
