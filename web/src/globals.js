/* Pustaka dibundel agar demo tidak bergantung jaringan acara. */
import { gsap } from 'gsap';
import qrcode from 'qrcode-generator';

window.gsap = gsap;
window.qrcode = qrcode;
