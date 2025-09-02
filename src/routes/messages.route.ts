import express, { Router } from "express";
import { smsController } from "../controllers/messages.controller.js";

const rotuer: Router = express.Router();

rotuer.post("/mail", smsController);


export default rotuer;
