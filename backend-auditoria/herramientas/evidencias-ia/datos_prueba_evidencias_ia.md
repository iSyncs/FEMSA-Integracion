# Script SQL · Evidencias PDF simuladas para la IA (FE1S-35)

Corre este script en Azure SQL para registrar en `dbo.EVIDENCE` los 40 PDF de `backend/src/datos/memoria/archivos-demo/`. Busca cada auditoría por `tracking_id` (sin ids fijos) y se puede correr dos veces sin duplicar nada, gracias al `WHERE NOT EXISTS` por `file_name`. El `size_bytes` y el `sha256` son los de los archivos de este PR.

El detalle de cada documento está en [manifiesto_evidencias_ia.md](manifiesto_evidencias_ia.md).

```sql
-- FE1S-35 · Evidencias PDF simuladas para la IA (ficticias)
-- Generado por scripts/generar_evidencias_ia.py. Los PDF viven en
-- backend/src/datos/memoria/archivos-demo/ del repo de la app (blob_url = 'demo://<archivo>').
-- Se puede correr más de una vez: no inserta archivos que ya estén registrados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @base INT = (
  SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(tracking_id, 9, 20) AS INT)), 0)
  FROM dbo.EVIDENCE WITH (UPDLOCK, HOLDLOCK) WHERE tracking_id LIKE 'SOPORTE-%');

INSERT INTO dbo.EVIDENCE (tracking_id, procedure_id, file_name, blob_url, mime_type, size_bytes, sha256, uploaded_by, deleted)
SELECT
  'SOPORTE-' + RIGHT('000000' + CAST(@base + ROW_NUMBER() OVER (ORDER BY v.orden) AS VARCHAR(10)), 6),
  (SELECT TOP 1 p.procedure_id FROM dbo.[PROCEDURE] p WHERE p.audit_id = a.audit_id ORDER BY p.procedure_id),
  v.archivo, 'demo://' + v.archivo, 'application/pdf', v.bytes, v.sha256, a.user_id, 0
FROM (VALUES
   (1, 'AUD-000001', 'aud000001_conteo_ciclico_alm03_sep2026.pdf', 4331, '786fba4f8a1d63ebd68c4ebf13d62a06d3367f9a721321e3966b8b4659f839f1')
  ,(2, 'AUD-000001', 'aud000001_ajuste_inventario_aj1187.pdf', 4057, 'c65e7117dd8c91d81dcbaecf3f4949668fee94d87a5067050265a00b264aa409')
  ,(3, 'AUD-000001', 'aud000001_kardex_jarabe_sku4410.pdf', 4002, 'eaa8dfaff3a0afc8d1f61ef8560063c377bbea1fdd0c5a027764229969d4d710')
  ,(4, 'AUD-000001', 'aud000001_entrada_almacen_ea5520.pdf', 3841, 'c3b31c6256b107f761401614d564616502afd1f394ff2e0b0e76237fed9661b9')
  ,(5, 'AUD-000001', 'aud000001_merma_producto_terminado_ago2026.pdf', 3904, '12585d17914ba0436cc6016ef08f5401ac8242b7a3ee33a334469cf01941f559')
  ,(6, 'AUD-000001', 'aud000001_acta_destruccion_ad0219.pdf', 3779, 'e82e20069ee06cb6597f40de9d50dbf7c46a190ae5534af06d7061a6bcd7bf0d')
  ,(7, 'AUD-000001', 'aud000001_traspaso_plantas_tr0884.pdf', 3769, 'bddbd99352607fe7933e0027bdf1d06d722ca92bafaf03a42f4929aba8952353')
  ,(8, 'AUD-000002', 'aud000002_alta_proveedor_prv20931.pdf', 3879, 'b862869fdbde8db75bc6125179b2f5b99cde28660522067ddbf4cd35902011dc')
  ,(9, 'AUD-000002', 'aud000002_orden_compra_oc77812.pdf', 3709, '45339a1ce556e31bf02c3dc44daa424c66749599d4f10a1137d5b23c31cd02bb')
  ,(10, 'AUD-000002', 'aud000002_factura_fac9930_recepcion.pdf', 3773, '2ac3cb361114951b8fc91a3ef0e866ef07a0a0e79e93de3c06f4dfe77b829f88')
  ,(11, 'AUD-000002', 'aud000002_autorizacion_pago_ap4471.pdf', 3717, '6123baa93dcf70313fc279a0861cd9be533e753ada037f7304d088cba920eb43')
  ,(12, 'AUD-000002', 'aud000002_conciliacion_bbva0123_ago2026.pdf', 3676, 'bf75bf74b619f537a49a658c879ad723e3dde874ef5a92af11474c5e78f39b80')
  ,(13, 'AUD-000002', 'aud000002_nota_credito_nc0315.pdf', 3696, 'f669cff3b49d9d8b18a394448fcc0f016aeeaa3264bb58749c058e6d4b470b6d')
  ,(14, 'AUD-000002', 'aud000002_contrato_marco_cm2024_018.pdf', 3845, '86ae0fe47f9fe9fc3a931bf04c60a1853ad46ae0476374518f4db73d847673f9')
  ,(15, 'AUD-000002', 'aud000002_transferencia_spei_tf88120.pdf', 3772, '169ce067e41130dce13bade98e3da9de29401af414ed6138d5f2203309a276cc')
  ,(16, 'AUD-000006', 'aud000006_bitacora_rutas_sp_ago2026.pdf', 5475, '977f2d7b8be7570603bc689a4c4767df35a528dc8e426aaf644eba3351b48964')
  ,(17, 'AUD-000006', 'aud000006_comprobante_entrega_ce5501.pdf', 3689, 'c749334f0b84d94baed1602dfa932ea8b39bceb82376bc06b7cb2e931c30ef74')
  ,(18, 'AUD-000006', 'aud000006_devolucion_producto_dv0712.pdf', 3407, '5b6b06ff493df3f1eacc2114462c571beb582b22e96502326335a47dae389d73')
  ,(19, 'AUD-000006', 'aud000006_control_combustible_frota12.pdf', 3934, '1dc7118a6576546a7438647f506465b01259027a9d634ba025ae922951b0e9f5')
  ,(20, 'AUD-000006', 'aud000006_mantenimiento_flota_mf221.pdf', 4078, 'f8eafe28a2cf724e2bca1bf10a101ad5aac62a89d32ff1531dc77e8e888ea98d')
  ,(21, 'AUD-000006', 'aud000006_faltante_ruta_fr0098.pdf', 3526, '3f7e738965cbd2ca5f2be8bbf3f69627467e8f1ed9a2e4e15bc9e8b8818592f5')
  ,(22, 'AUD-000007', 'aud000007_expediente_kyc_cl40921.pdf', 3705, '5aea645d1728fcf6413c519d09532a28a57909f747cd7596a555079b3002def8')
  ,(23, 'AUD-000007', 'aud000007_alerta_operacion_inusual_al1180.pdf', 3667, '4fff3f989a4e79080ffd29742d75779852cafb40d636a4dbd9dd0e36c305e5dc')
  ,(24, 'AUD-000007', 'aud000007_reporte_uif_ro0042.pdf', 3604, '5ff809be8a7c28b18957fae92f5940955e2750961d4eca0c51708113c2115953')
  ,(25, 'AUD-000007', 'aud000007_matriz_riesgo_clientes_q3.pdf', 3807, 'b0f6b9a441e130840551a9bb00811c01630a656fb822ebf89773af4a8810b669')
  ,(26, 'AUD-000007', 'aud000007_capacitacion_pld_2026.pdf', 3673, 'b4b71aac44fc0fe7bb2cac827175ff41b0fe18689445ca81f8d8e986ef5744b9')
  ,(27, 'AUD-000007', 'aud000007_revision_listas_restringidas_lr0907.pdf', 3721, '16ec590d836fbdb81e0a13301afecc5d85990261192220cb09b9e2675218fba3')
  ,(28, 'AUD-000007', 'aud000007_bitacora_monitoreo_sep2026.pdf', 3724, '9f452b1474aeb3ceebf8cc39250de876f50174672bffa37beef8cbe3ab1ca579')
  ,(29, 'AUD-000008', 'aud000008_corte_caja_tienda1842_0913.pdf', 3573, '927d252b22e3dc99af4d2b6aa6fa154d336a69d913df7f66dab6c2f90bddd277')
  ,(30, 'AUD-000008', 'aud000008_deposito_banco_dp33019.pdf', 3571, 'c4d8c5a4684239ac37f199de04fc75b93f1a5928362e9ec6ed443f90c8a5b6d4')
  ,(31, 'AUD-000008', 'aud000008_recoleccion_valores_rv7712.pdf', 3627, '13ae97bdca67769c3b09861d6ddd7c3aa33f7a6d14741e282b2ce099c1d6e9c3')
  ,(32, 'AUD-000008', 'aud000008_fondo_fijo_tienda2210.pdf', 3590, '091136df2b8b819398b7060dbbfe23b74b23283d46609c52332a4327f3b28994')
  ,(33, 'AUD-000008', 'aud000008_faltante_caja_fc0451.pdf', 3466, '28a6d77d61b80ec9f2282982a327cb75e8006995f335ec89ee4f18d8fee52fe6')
  ,(34, 'AUD-000008', 'aud000008_bitacora_caja_fuerte_sep2026.pdf', 4140, '096663972b64599a4253dd71a0ed6eb70dc1e853413b14cd5fb6478857c346a7')
  ,(35, 'AUD-000011', 'aud000011_manifiesto_residuos_mr2290.pdf', 3796, '79931e16b04f099ff38fc76024448cdf78dc6b0c95bb0f318476bed6f2d43f82')
  ,(36, 'AUD-000011', 'aud000011_bitacora_reciclaje_ago2026.pdf', 3531, '70610942b0a99647acdadd39b2d2bef5a12a1344da8772b42c4acc3094d1ed10')
  ,(37, 'AUD-000011', 'aud000011_reporte_esg_septiembre.pdf', 3637, '5a4d5ebf79ac542d540a0e11cc11c556d0196864c42de35b2bc7b0c544f0ec86')
  ,(38, 'AUD-000011', 'aud000011_certificado_disposicion_cd0118.pdf', 3612, '2a3983582067c1c7cc40bc099f329d68a2d9b1a01023b28deaeaadfcbf8b525a')
  ,(39, 'AUD-000011', 'aud000011_consumo_energia_tiendas_q3.pdf', 3673, '9741b43467a8f7ef66cc6819c6ba4d61544372c1b951c5e2093e1c9c9dc67afd')
  ,(40, 'AUD-000011', 'aud000011_contrato_recolector_cr0076.pdf', 3637, 'f98acc9ff5e18ef3e3c27c1e354df09565fddfeaeae0f127c638cccad70ee116')
) AS v (orden, auditoria, archivo, bytes, sha256)
JOIN dbo.AUDIT a ON a.tracking_id = v.auditoria
WHERE NOT EXISTS (SELECT 1 FROM dbo.EVIDENCE e WHERE e.file_name = v.archivo AND e.deleted = 0);

COMMIT;

-- Verificación: debe dar 7, 8, 6, 7, 9 (6 + 3 de Jorge) y 6
SELECT a.tracking_id, COUNT(*) AS evidencias_pdf
FROM dbo.EVIDENCE e
JOIN dbo.[PROCEDURE] p ON p.procedure_id = e.procedure_id
JOIN dbo.AUDIT a ON a.audit_id = p.audit_id
WHERE e.blob_url LIKE 'demo://%' AND e.deleted = 0
GROUP BY a.tracking_id ORDER BY a.tracking_id;
```
