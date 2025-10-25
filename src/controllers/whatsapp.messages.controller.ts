import axios from 'axios';
import type { Request, Response } from 'express';
import axiosInstance from '../utils/axios.js';
import { uploadFileToGoogleDrive } from '../utils/googleApis.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

import { uploadImageToSupabase } from '../utils/uploadImageToSupabase.js';
import { supabase } from '../helper/supabase.js';

export const whatsappSendTransationPdf = async (req: Request, res: Response) => {
  const { clientName, clientNumber, storeId, storeName, invoiceNo } = (req as any).body || {};
  const file = (req as any).file as any;

  if (!clientName || !clientNumber) {
    return res.status(400).json({
      ok: false,
      message: 'clientName and clientNumber are required',
    });
  }

  if (!file) {
    return res.status(400).json({ ok: false, message: 'pdfFile is required' });
  }

  // Validate WhatsApp credentials
  if (!process.env.WHATSAPP_END_POINT || !process.env.WHATSAPP_ACCESS_TOKEN) {
    console.error('[Transaction Bill] Missing WhatsApp credentials');
    return res.status(500).json({
      ok: false,
      message: 'WhatsApp API credentials not configured. Please contact administrator.',
    });
  }

  try {
    if (storeId) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('monthly_quota, used_messages')
        .eq('id', storeId)
        .single();

      if (!storeError && storeData) {
        const { monthly_quota = 0, used_messages = 0 } = storeData;
        const remainingQuota = monthly_quota - used_messages;

        if (remainingQuota <= 0) {
          console.log(
            `[Transaction Bill] Quota exceeded for store ${storeId}: ${used_messages}/${monthly_quota}`
          );
          return res.status(403).json({
            ok: false,
            message: 'Monthly WhatsApp quota exceeded. Please recharge to continue.',
            quota: { monthly_quota, used_messages, remaining: 0 },
          });
        }
        console.log(
          `[Transaction Bill] Quota check passed: ${used_messages}/${monthly_quota} messages used`
        );
      }
    }

    const newPath = `billUpload/${file.originalname}`;

    await uploadImageToSupabase(newPath, file.buffer, 'pdf', file.mimetype);

    const payLoad = {
      messaging_product: 'whatsapp',
      to: `91${clientNumber}`,
      type: 'template',
      template: {
        name: 'pdf_bill_temp',
        language: {
          code: 'en',
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: clientName },
              { type: 'text', text: storeName || 'Botivate Saloon' },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: file.originalname,
              },
            ],
          },
        ],
      },
    };

    const { data } = await axios({
      method: 'POST',
      url: process.env.WHATSAPP_END_POINT,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: payLoad,
    });

    process.env.NODE_ENV === 'development' && console.log(data, 'data from the whatsapp api ');

    console.log(`[Transaction Bill] WhatsApp bill sent successfully to ${clientNumber}`);

    // Update used_messages counter if storeId is provided
    if (storeId) {
      const { data: currentStore } = await supabase
        .from('stores')
        .select('used_messages')
        .eq('id', storeId)
        .single();

      if (currentStore) {
        const { error: updateError } = await supabase
          .from('stores')
          .update({ used_messages: (currentStore.used_messages || 0) + 1 })
          .eq('id', storeId);

        if (updateError) {
          console.error('[Transaction Bill] Failed to update quota:', updateError);
        } else {
          console.log(
            `[Transaction Bill] Updated quota: ${currentStore.used_messages} -> ${(currentStore.used_messages || 0) + 1}`
          );
        }
      }
    }

    return res.status(200).json({ message: 'done', data: data });
  } catch (error: any) {
    console.error('Error Response:', JSON.stringify(error?.response?.data, null, 2));

    const status = error?.response?.status;
    const errData = error?.response?.data;
    const httpStatus = typeof status === 'number' ? status : 500;
    return res.status(httpStatus).json({
      ok: false,
      message: 'Failed to upload file or send WhatsApp message',
      error: errData ?? error?.message,
    });
  }
};

export const getWhatsappTemplates = async (req: Request, res: Response) => {
  try {
    if (!process.env.WHATSAPP_END_POINT) {
      throw new Error('Whatsapp end point not found');
    }
    const { data } = await axiosInstance({
      method: 'GET',

      url: `${process.env.WHATSAPP_BUSSINESS_ACCOUNT_BASE_URL}/1116828697264680/message_templates?access_token=${process.env.WHATSAPP_ACCESS_TOKEN}`,
    });

    return res.status(200).json({ message: 'done', data: data });
  } catch (error: any) {
    // Surface detailed error information if available
    const status = error?.response?.status;
    const errData = error?.response?.data;
    console.error('WhatsApp API error:', {
      status,
      data: errData,
      message: error?.message,
    });
    const httpStatus = typeof status === 'number' ? status : 500;
    return res
      .status(httpStatus)
      .json({ message: 'Failed to send WhatsApp message', error: errData ?? error?.message });
  }
};

//note: here we are sending the whatsapp message like normal message along with image
export const sendWhatsApp = async (req: Request, res: Response) => {
  const { message, name, phoneNumber, templateName, templateLanguage, storeId } =
    (req as any).body || {};
  const rawComponents = (req as any).body?.components;

  let components;
  if (rawComponents && rawComponents !== 'undefined') {
    components = typeof rawComponents === 'string' ? JSON.parse(rawComponents) : rawComponents;
  } else {
    components = undefined;
  }

  const file = (req as any).file as Express.Multer.File | undefined;

  if (storeId) {
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('monthly_quota, used_messages')
      .eq('id', storeId)
      .single();

    if (!storeError && storeData) {
      const { monthly_quota = 0, used_messages = 0 } = storeData;
      const remainingQuota = monthly_quota - used_messages;

      if (remainingQuota <= 0) {
        return res.status(403).json({
          ok: false,
          message: 'Monthly WhatsApp quota exceeded. Please recharge to continue.',
          quota: { monthly_quota, used_messages, remaining: 0 },
        });
      }
    }
  }

  let supabasePublicUrl: string | undefined;
  if (file && (file as any).buffer) {
    const uploadPath = `whatsApptemp/${Date.now()}_${file.originalname}`;

    const up = await uploadImageToSupabase(
      uploadPath,
      (file as any).buffer,
      'whatsappImage',
      (file as any).mimetype
    );

    supabasePublicUrl = up.publicUrl;
  }

  if (!phoneNumber || !templateName || !templateLanguage) {
    return res.status(400).json({
      ok: false,
      message: 'phoneNumber, templateName and templateLanguage are required',
    });
  }

  // Check quota if storeId is provided

  try {
    const normalizeComponents = (comps: any[] | undefined) => {
      if (!Array.isArray(comps)) return undefined;
      return comps.filter(Boolean).map((c: any) => {
        const type = String(c?.type || '').toLowerCase();

        if (type === 'header') {
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params
            .map((p: any) => {
              const pType = String(p?.type || '').toLowerCase();

              if (pType === 'image') {
                const payload: any = {};

                // Priority: custom link > custom id > template example link > template example id
                if (p?.image?.link) {
                  payload.link = String(p.image.link);
                } else if (p?.image?.id) {
                  payload.id = String(p.image.id);
                } else if (p?.image?.exampleLink) {
                  // Use template's example image link as fallback
                  payload.link = String(p.image.exampleLink);
                } else if (p?.image?.exampleId) {
                  // Use template's example image id as fallback
                  payload.id = String(p.image.exampleId);
                }

                // Only return if we have either link or id
                if (payload.link || payload.id) {
                  return { type: 'image', image: payload };
                }
              }

              // Handle VIDEO type
              if (pType === 'video') {
                const payload: any = {};

                if (p?.video?.link) {
                  payload.link = String(p.video.link);
                } else if (p?.video?.id) {
                  payload.id = String(p.video.id);
                } else if (p?.video?.exampleLink) {
                  payload.link = String(p.video.exampleLink);
                } else if (p?.video?.exampleId) {
                  payload.id = String(p.video.exampleId);
                }

                if (payload.link || payload.id) {
                  return { type: 'video', video: payload };
                }
              }

              // Handle DOCUMENT type
              if (pType === 'document') {
                const payload: any = {};

                if (p?.document?.link) {
                  payload.link = String(p.document.link);
                } else if (p?.document?.id) {
                  payload.id = String(p.document.id);
                } else if (p?.document?.exampleLink) {
                  payload.link = String(p.document.exampleLink);
                } else if (p?.document?.exampleId) {
                  payload.id = String(p.document.exampleId);
                }

                if (payload.link || payload.id) {
                  return { type: 'document', document: payload };
                }
              }

              // Handle TEXT type
              if (pType === 'text' && p?.text != null) {
                return { type: 'text', text: String(p.text) };
              }

              return p;
            })
            .filter(Boolean); // Remove any undefined/null parameters

          return { type: 'header', parameters: normalizedParams };
        }

        if (type === 'body') {
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params.map((p: any) => ({
            type: 'text',
            text: String(p?.text ?? ''),
          }));
          return { type: 'body', parameters: normalizedParams };
        }

        if (type === 'button') {
          const sub_type = String(c?.sub_type || '').toLowerCase();
          const index = String(c?.index ?? '0');
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params.map((p: any) => ({
            type: 'text',
            text: String(p?.text ?? ''),
          }));
          return { type: 'button', sub_type, index, parameters: normalizedParams };
        }

        return c;
      });
    };

    const normalizedComponents = normalizeComponents(components) || [];

    const isHttp = (url?: string) => typeof url === 'string' && /^https?:\/\//.test(url);
    const isData = (url?: string) => typeof url === 'string' && /^data:/i.test(url);
    const isBlob = (url?: string) => typeof url === 'string' && /^blob:/i.test(url);

    const enhancedComponents = await (async () => {
      const compsCopy = JSON.parse(JSON.stringify(normalizedComponents)) as any[];
      const headerIdx = compsCopy.findIndex((c) => (c?.type || '').toUpperCase() === 'HEADER');
      if (headerIdx === -1) return compsCopy;
      const header = compsCopy[headerIdx];
      const params = Array.isArray(header.parameters) ? header.parameters : [];

      const updatedParams = [] as any[];
      for (const p of params) {
        const pType = String(p?.type || '').toLowerCase();
        if (pType === 'image' && p?.image) {
          const link = p.image.link as string;
          if (isBlob(link) && supabasePublicUrl) {
            updatedParams.push({ type: 'image', image: { link: supabasePublicUrl } });
            continue;
          }
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({ type: 'image', image: { link } });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            console.log(
              `[Cloudinary] Uploading image, type: ${isData(link) ? 'data URL' : 'HTTP URL'}, length: ${link?.length || 0}`
            );
            try {
              const up = await uploadToCloudinary({ url: link, filename: 'wa_image' });
              console.log(`[Cloudinary] Upload success: ${up.secure_url || up.url}`);
              updatedParams.push({ type: 'image', image: { link: up.secure_url || up.url } });
              continue;
            } catch (uploadErr: any) {
              console.error('[Cloudinary] Upload failed:', uploadErr?.message || uploadErr);
              throw new Error(
                `Image upload to Cloudinary failed: ${uploadErr?.message || 'Unknown error'}`
              );
            }
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        if (pType === 'video' && p?.video) {
          const link = p.video.link as string;
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({ type: 'video', video: { link } });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            console.log(
              `[Cloudinary] Uploading video, type: ${isData(link) ? 'data URL' : 'HTTP URL'}, length: ${link?.length || 0}`
            );
            try {
              const up = await uploadToCloudinary({
                url: link,
                filename: 'wa_video',
                resourceTypeHint: 'video',
              });
              console.log(`[Cloudinary] Video upload success: ${up.secure_url || up.url}`);
              updatedParams.push({ type: 'video', video: { link: up.secure_url || up.url } });
              continue;
            } catch (uploadErr: any) {
              console.error('[Cloudinary] Video upload failed:', uploadErr?.message || uploadErr);
              throw new Error(
                `Video upload to Cloudinary failed: ${uploadErr?.message || 'Unknown error'}`
              );
            }
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        if (pType === 'document' && p?.document) {
          const link = p.document.link as string;
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({
                type: 'document',
                document: { link, filename: p.document.filename },
              });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            const up = await uploadToCloudinary({
              url: link,
              filename: p.document.filename || 'wa_document',
              resourceTypeHint: 'raw',
            });
            updatedParams.push({
              type: 'document',
              document: { link: up.secure_url || up.url, filename: p.document.filename },
            });
            continue;
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        // passthrough param if not uploaded
        updatedParams.push(p);
      }
      compsCopy[headerIdx] = { ...header, parameters: updatedParams };
      return compsCopy;
    })();

    const payLoad: any = {
      messaging_product: 'whatsapp',
      to: `91${phoneNumber}`,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
        components: enhancedComponents,
      },
    };

    const { data } = await axios({
      method: 'POST',
      url: process.env.WHATSAPP_END_POINT,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: payLoad,
    });

    // Update used_messages counter if storeId is provided
    if (storeId) {
      // Fetch current value first, then increment
      const { data: currentStore } = await supabase
        .from('stores')
        .select('used_messages')
        .eq('id', storeId)
        .single();

      if (currentStore) {
        const { error: updateError } = await supabase
          .from('stores')
          .update({ used_messages: (currentStore.used_messages || 0) + 1 })
          .eq('id', storeId);

        if (updateError) {
          console.error('[Send WhatsApp] Failed to update quota:', updateError);
        }
      }
    }

    return res.status(200).json({ ok: true, message: 'sent', data });
  } catch (error: any) {
    console.error('WhatsApp send error:', JSON.stringify(error?.response?.data, null, 2));
    const status = error?.response?.status;
    const errData = error?.response?.data;
    const httpStatus = typeof status === 'number' ? status : 500;
    return res.status(httpStatus).json({
      ok: false,
      message: 'Failed to send WhatsApp message',
      error: errData ?? error?.message,
    });
  }
};

export const sendWhatsAppBulk = async (req: Request, res: Response) => {
  try {
    const rawComponents = (req as any).body?.components;
    const templateName = (req as any).body?.templateName as string | undefined;
    const templateLanguage = (req as any).body?.templateLanguage as string | undefined;
    const rawPhoneNumbers = (req as any).body?.phoneNumbers;
    const phoneNumbers =
      typeof rawPhoneNumbers === 'string' ? JSON.parse(rawPhoneNumbers) : rawPhoneNumbers || [];
    const storeId = (req as any).body?.storeId as string | undefined;
    const file = (req as any).file as Express.Multer.File | undefined;

    let supabasePublicUrl: string | undefined;
    if (file && (file as any).buffer) {
      const uploadPath = `whatsapp/${Date.now()}_${file.originalname}`;
      const up = await uploadImageToSupabase(
        uploadPath,
        (file as any).buffer,
        'whatsappImage',
        (file as any).mimetype
      );

      supabasePublicUrl = up.publicUrl;
    }

    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ ok: false, message: 'phoneNumbers[] is required' });
    }
    if (!templateName || !templateLanguage) {
      return res
        .status(400)
        .json({ ok: false, message: 'templateName and templateLanguage are required' });
    }
    if (!storeId) {
      return res.status(400).json({ ok: false, message: 'storeId is required' });
    }

    // Check quota before sending
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('monthly_quota, used_messages')
      .eq('id', storeId)
      .single();

    if (storeError || !storeData) {
      console.error('[Bulk Send] Store not found:', storeError);
      return res.status(404).json({ ok: false, message: 'Store not found' });
    }

    const { monthly_quota = 0, used_messages = 0 } = storeData;
    const remainingQuota = monthly_quota - used_messages;

    if (remainingQuota <= 0) {
      console.log(
        `[Bulk Send] Quota exceeded for store ${storeId}: ${used_messages}/${monthly_quota}`
      );
      return res.status(403).json({
        ok: false,
        message: 'Monthly WhatsApp quota exceeded. Please recharge to continue.',
        quota: { monthly_quota, used_messages, remaining: 0 },
      });
    }

    if (phoneNumbers.length > remainingQuota) {
      console.log(
        `[Bulk Send] Insufficient quota for store ${storeId}: Need ${phoneNumbers.length}, have ${remainingQuota}`
      );
      return res.status(403).json({
        ok: false,
        message: `Insufficient quota. You have ${remainingQuota} messages remaining but trying to send ${phoneNumbers.length}.`,
        quota: { monthly_quota, used_messages, remaining: remainingQuota },
      });
    }

    // Validate WhatsApp credentials
    if (!process.env.WHATSAPP_END_POINT || !process.env.WHATSAPP_ACCESS_TOKEN) {
      console.error('[Bulk Send] Missing WhatsApp credentials');
      return res.status(500).json({
        ok: false,
        message: 'WhatsApp API credentials not configured. Please contact administrator.',
      });
    }

    // Handle components properly - check for undefined string and missing components
    let components;
    if (rawComponents && rawComponents !== 'undefined') {
      components = typeof rawComponents === 'string' ? JSON.parse(rawComponents) : rawComponents;
    } else {
      components = undefined;
    }

    console.log(
      `[Bulk Send] Starting bulk send to ${phoneNumbers.length} recipients with template: ${templateName} (Store: ${storeId}, Quota: ${used_messages}/${monthly_quota})`
    );

    const normalizeComponents = (comps: any[] | undefined) => {
      if (!Array.isArray(comps)) return undefined;
      return comps.filter(Boolean).map((c: any) => {
        const type = String(c?.type || '').toLowerCase();

        if (type === 'header') {
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params
            .map((p: any) => {
              const pType = String(p?.type || '').toLowerCase();

              if (pType === 'image') {
                const payload: any = {};
                if (p?.image?.link) {
                  payload.link = String(p.image.link);
                } else if (p?.image?.id) {
                  payload.id = String(p.image.id);
                } else if (p?.image?.exampleLink) {
                  payload.link = String(p.image.exampleLink);
                } else if (p?.image?.exampleId) {
                  payload.id = String(p.image.exampleId);
                }
                if (payload.link || payload.id) {
                  return { type: 'image', image: payload };
                }
              }

              if (pType === 'video') {
                const payload: any = {};
                if (p?.video?.link) {
                  payload.link = String(p.video.link);
                } else if (p?.video?.id) {
                  payload.id = String(p.video.id);
                } else if (p?.video?.exampleLink) {
                  payload.link = String(p.video.exampleLink);
                } else if (p?.video?.exampleId) {
                  payload.id = String(p.video.exampleId);
                }
                if (payload.link || payload.id) {
                  return { type: 'video', video: payload };
                }
              }

              if (pType === 'document') {
                const payload: any = {};
                if (p?.document?.link) {
                  payload.link = String(p.document.link);
                } else if (p?.document?.id) {
                  payload.id = String(p.document.id);
                } else if (p?.document?.exampleLink) {
                  payload.link = String(p.document.exampleLink);
                } else if (p?.document?.exampleId) {
                  payload.id = String(p.document.exampleId);
                }
                if (payload.link || payload.id) {
                  return { type: 'document', document: payload };
                }
              }

              if (pType === 'text' && p?.text != null) {
                return { type: 'text', text: String(p.text) };
              }

              return p;
            })
            .filter(Boolean);

          return { type: 'header', parameters: normalizedParams };
        }

        if (type === 'body') {
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params.map((p: any) => ({
            type: 'text',
            text: String(p?.text ?? ''),
          }));
          return { type: 'body', parameters: normalizedParams };
        }

        if (type === 'button') {
          const sub_type = String(c?.sub_type || '').toLowerCase();
          const index = String(c?.index ?? '0');
          const params = Array.isArray(c?.parameters) ? c.parameters : [];
          const normalizedParams = params.map((p: any) => ({
            type: 'text',
            text: String(p?.text ?? ''),
          }));
          return { type: 'button', sub_type, index, parameters: normalizedParams };
        }

        return c;
      });
    };

    const normalizedComponents = normalizeComponents(components) || [];

    const isHttp = (url?: string) => typeof url === 'string' && /^https?:\/\//.test(url);
    const isData = (url?: string) => typeof url === 'string' && /^data:/i.test(url);
    const isBlob = (url?: string) => typeof url === 'string' && /^blob:/i.test(url);

    const enhancedComponents = await (async () => {
      const compsCopy = JSON.parse(JSON.stringify(normalizedComponents)) as any[];
      const headerIdx = compsCopy.findIndex((c) => (c?.type || '').toUpperCase() === 'HEADER');
      if (headerIdx === -1) return compsCopy;
      const header = compsCopy[headerIdx];
      const params = Array.isArray(header.parameters) ? header.parameters : [];

      const updatedParams = [] as any[];
      for (const p of params) {
        const pType = String(p?.type || '').toLowerCase();
        if (pType === 'image' && p?.image) {
          const link = p.image.link as string;
          if (isBlob(link) && supabasePublicUrl) {
            updatedParams.push({ type: 'image', image: { link: supabasePublicUrl } });
            continue;
          }
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({ type: 'image', image: { link } });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            console.log(
              `[Cloudinary] Uploading image, type: ${isData(link) ? 'data URL' : 'HTTP URL'}, length: ${link?.length || 0}`
            );
            try {
              const up = await uploadToCloudinary({ url: link, filename: 'wa_image' });

              console.log(`[Cloudinary] Upload success: ${up.secure_url || up.url}`);
              updatedParams.push({ type: 'image', image: { link: up.secure_url || up.url } });
              continue;
            } catch (uploadErr: any) {
              console.error('[Cloudinary] Upload failed:', uploadErr?.message || uploadErr);
              throw new Error(
                `Image upload to Cloudinary failed: ${uploadErr?.message || 'Unknown error'}`
              );
            }
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        if (pType === 'video' && p?.video) {
          const link = p.video.link as string;
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({ type: 'video', video: { link } });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            console.log(
              `[Cloudinary] Uploading video, type: ${isData(link) ? 'data URL' : 'HTTP URL'}, length: ${link?.length || 0}`
            );
            try {
              const up = await uploadToCloudinary({
                url: link,
                filename: 'wa_video',
                resourceTypeHint: 'video',
              });
              console.log(`[Cloudinary] Video upload success: ${up.secure_url || up.url}`);
              updatedParams.push({ type: 'video', video: { link: up.secure_url || up.url } });
              continue;
            } catch (uploadErr: any) {
              console.error('[Cloudinary] Video upload failed:', uploadErr?.message || uploadErr);
              throw new Error(
                `Video upload to Cloudinary failed: ${uploadErr?.message || 'Unknown error'}`
              );
            }
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        if (pType === 'document' && p?.document) {
          const link = p.document.link as string;
          if (isHttp(link)) {
            if (/supabase/i.test(link)) {
              updatedParams.push({
                type: 'document',
                document: { link, filename: p.document.filename },
              });
              continue;
            }
          }
          if (isHttp(link) || isData(link)) {
            const up = await uploadToCloudinary({
              url: link,
              filename: p.document.filename || 'wa_document',
              resourceTypeHint: 'raw',
            });
            updatedParams.push({
              type: 'document',
              document: { link: up.secure_url || up.url, filename: p.document.filename },
            });
            continue;
          }
          if (isBlob(link)) {
            throw new Error(
              'Invalid media link: blob: URLs cannot be used by the server. Upload media first to obtain a public URL.'
            );
          }
        }
        updatedParams.push(p);
      }
      compsCopy[headerIdx] = { ...header, parameters: updatedParams };
      return compsCopy;
    })();
    const rateDelayMs = 1000; // 1 second delay between messages
    const results: { to: string; ok: boolean; error?: any; data?: any }[] = [];

    for (const raw of phoneNumbers) {
      const phone = String(raw || '').trim();
      if (!phone) {
        results.push({ to: String(raw), ok: false, error: 'invalid phoneNumber' });
        continue;
      }

      const payLoad: any = {
        messaging_product: 'whatsapp',
        to: `91${phone}`,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: enhancedComponents,
        },
      };

      console.log(payLoad, 'payload');
      return;
      try {
        const { data } = await axios({
          method: 'POST',
          url: process.env.WHATSAPP_END_POINT,
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          data: payLoad,
        });
        console.log(`[Bulk Send] Success for ${phone}`);
        results.push({ to: phone, ok: true, data });
      } catch (err: any) {
        const errorDetail = err?.response?.data || err?.message;
        console.error(`[Bulk Send] Failed for ${phone}:`, errorDetail);
        results.push({ to: phone, ok: false, error: errorDetail });
      }

      // Wait 1 second before next message to avoid Meta rate limits
      if (phoneNumbers.indexOf(raw) < phoneNumbers.length - 1) {
        await new Promise((r) => setTimeout(r, rateDelayMs));
      }
    }

    const success = results.filter((r) => r.ok).length;
    const failed = results.length - success;

    console.log(
      `[Bulk Send] Completed: ${success} success, ${failed} failed out of ${results.length} total`
    );

    // Update used_messages counter for successful sends
    if (success > 0) {
      const { error: updateError } = await supabase
        .from('stores')
        .update({ used_messages: used_messages + success })
        .eq('id', storeId);

      if (updateError) {
        console.error('[Bulk Send] Failed to update quota:', updateError);
      } else {
        console.log(`[Bulk Send] Updated quota: ${used_messages} -> ${used_messages + success}`);
      }
    }

    return res.status(200).json({ ok: true, success, failed, total: results.length, results });
  } catch (error: any) {
    console.error('[Bulk Send Error]:', {
      message: error?.message,
      stack: error?.stack,
      responseStatus: error?.response?.status,
      responseData: error?.response?.data,
    });

    const status = error?.response?.status;
    const errData = error?.response?.data;
    const httpStatus = typeof status === 'number' ? status : 500;
    return res
      .status(httpStatus)
      .json({ ok: false, message: 'Bulk send failed', error: errData ?? error?.message });
  }
};

//info: Get Quota

export const getQuota = async (req: Request, res: Response) => {
  const { storeId } = req.body;

  console.log(storeId, 'storeId');
  if (!storeId) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }

  const { data: storeData, error } = await supabase
    .from('stores')
    .select('monthly_quota , used_messages')
    .eq('id', storeId);

  if (error) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to get quota', error: error.message });
  }

  const row = Array.isArray(storeData) ? storeData[0] : storeData;

  const { monthly_quota, used_messages } = row as { monthly_quota: number; used_messages: number };

  if (used_messages >= monthly_quota) {
    return res.status(200).json({ ok: false, message: 'Quota exceeded' });
  }

  return res.status(200).json({
    ok: true,
    message: 'you can send the message',
    data: { monthly_quota, used_messages },
  });
};

//info: Update Quota

export async function updateQuota(req: Request, res: Response) {
  const { storeId } = req.body;

  if (!storeId) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }

  const { data: storeData, error } = await supabase
    .from('stores')
    .select('monthly_quota , used_messages')
    .eq('id', storeId);

  if (error) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to get quota', error: error.message });
  }

  const row = Array.isArray(storeData) ? storeData[0] : storeData;

  const { monthly_quota, used_messages } = row as { monthly_quota: number; used_messages: number };

  if (used_messages >= monthly_quota) {
    return res.status(200).json({ ok: false, message: 'Quota exceeded' });
  }

  const { data, error: afterUpdate } = await supabase
    .from('stores')
    .update({ used_messages: used_messages + 1 })
    .eq('id', storeId);

  if (afterUpdate) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to update quota', error: afterUpdate.message });
  }

  return res.status(200).json({ ok: true, message: 'Quota updated successfully', data });
}

//info: Get Dashboard Get-Dashobard Data

export async function getDashboardData(req: Request, res: Response) {
  const storeId = (req as any)?.body?.storeId || (req as any)?.query?.storeId;



  if (!storeId) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }

  const { data: storeData, error } = await supabase
    .from('stores')
    .select('monthly_quota, used_messages,recharge_price')
    .eq('id', storeId);

  if (error) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to get dashboard data', error: error.message });
  }

  const row = Array.isArray(storeData) ? storeData?.[0] : storeData;
  const monthly_quota = Number((row as any)?.monthly_quota || 0);
  const used_messages = Number((row as any)?.used_messages || 0);

  const total_messages = monthly_quota;
  const sent_messages = Math.min(used_messages, total_messages);
  const messages_remaining = Math.max(total_messages - sent_messages, 0);
  const usage_percentage = total_messages > 0 ? sent_messages / total_messages : 0;
  const low_quota = usage_percentage >= 0.8;

  const total_recharge: number | null = (row as any)?.recharge_price || null;
  const last_recharge_date: string | null = (row as any)?.last_recharge_date || null;

  return res.status(200).json({
    ok: true,
    message: 'Dashboard data fetched',
    data: {
      total_messages,
      sent_messages,
      messages_remaining,
      low_quota,
      total_recharge,
      last_recharge_date,
    },
  });
}

// info: Get full Store details for dashboard
export async function getStoreDetails(req: Request, res: Response) {
  const storeId = (req as any)?.body?.storeId || (req as any)?.query?.storeId;
  if (!storeId) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }
  const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();

  if (error) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to get store details', error: error.message });
  }

  return res.status(200).json({ ok: true, data });
}

export async function sendAppointmentWhatsappMessage(req: Request, res: Response) {
  const { storeId, storeName, customerNumber, customerName } = req.body;
  if (!storeName || !customerNumber || !customerName) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }

  if (!storeId) {
    return res.status(400).json({ ok: false, message: 'Shop ID is required' });
  }

  const { data: storeData, error } = await supabase
    .from('stores')
    .select('monthly_quota , used_messages')
    .eq('id', storeId);

  if (error) {
    return res
      .status(500)
      .json({ ok: false, message: 'Failed to get quota', error: error.message });
  }

  const row = Array.isArray(storeData) ? storeData[0] : storeData;

  const { monthly_quota, used_messages } = row as { monthly_quota: number; used_messages: number };

  if (used_messages >= monthly_quota) {
    return res.status(200).json({ ok: false, message: 'Quota exceeded' });
  }

  const payLoad: any = {
    messaging_product: 'whatsapp',
    to: `91${customerNumber}`,
    type: 'template',
    template: {
      name: 'after_creating_appointment ',
      language: {
        code: 'en',
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: customerName,
            },
            {
              type: 'text',
              text: storeName,
            },
          ],
        },
      ],
    },
  };
  try {
    const { data } = await axios({
      method: 'POST',
      url: process.env.WHATSAPP_END_POINT,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: payLoad,
    });

    const { error: afterUpdate } = await supabase
      .from('stores')
      .update({ used_messages: used_messages + 1 })
      .eq('id', storeId);

    if (afterUpdate) {
      return res
        .status(500)
        .json({ ok: false, message: 'Failed to update quota', error: afterUpdate.message });
    }
    return res.status(200).json({ status: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ ok: false, message: 'Failed to send WhatsApp message' });
  }
}
