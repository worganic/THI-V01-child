// Les recettes ne sont plus une application autonome : elles sont montées dans le
// portail (route `/recettes`, voir apps/portail/src/app/base-routes.ts). Toutes les
// requêtes passent par l'API du portail (server/server-data.js, port 3001) et non
// plus par le proxy Angular de portail-shell.
//
// `runtimeEnv` applique déjà le décalage de port des instances multi-users.
import { runtimeEnv } from '../../portail/src/app/runtime-env';

export const environment = {
  production: false,

  // Base de l'API portail — conservée sous le nom `serviceVal` pour ne pas réécrire
  // tous les appels du service (`environment.serviceVal + environment.serviceXxx`).
  serviceVal: runtimeEnv.apiDataUrl,

  // Service Recettes — mêmes verbes qu'à l'origine (GET liste, POST insert,
  // POST update/, DELETE del/), servis par server/modules/appli-recettes.js
  serviceRecipeBook: '/api/recettes/recipe_book/',
  serviceRecipeBookUpdate: '/api/recettes/recipe_book/update/',
  serviceRecipeBookInsert: '/api/recettes/recipe_book/',
  serviceRecipeBookDelete: '/api/recettes/recipe_book/del/',

  serviceRecipeCategory: '/api/recettes/recipe_category/',
  serviceRecipeCategoryUpdate: '/api/recettes/recipe_category/update/',
  serviceRecipeCategoryInsert: '/api/recettes/recipe_category/',
  serviceRecipeCategoryDelete: '/api/recettes/recipe_category/del/',

  serviceRecipeApplicatif: '/api/recettes/recipe_applicatif/',
  serviceRecipeApplicatifUpdate: '/api/recettes/recipe_applicatif/update/',
  serviceRecipeApplicatifInsert: '/api/recettes/recipe_applicatif/',
  serviceRecipeApplicatifDelete: '/api/recettes/recipe_applicatif/del/',

  serviceRecipeSection: '/api/recettes/recipe_section/',
  serviceRecipeSectionUpdate: '/api/recettes/recipe_section/update/',
  serviceRecipeSectionInsert: '/api/recettes/recipe_section/',
  serviceRecipeSectionDelete: '/api/recettes/recipe_section/del/',

  serviceRecipeTest: '/api/recettes/recipe_test/',
  serviceRecipeTestUpdate: '/api/recettes/recipe_test/update/',
  serviceRecipeTestInsert: '/api/recettes/recipe_test/',
  serviceRecipeTestDelete: '/api/recettes/recipe_test/del/',

  serviceRecipeTask: '/api/recettes/recipe_task/',
  serviceRecipeTaskUpdate: '/api/recettes/recipe_task/update/',
  serviceRecipeTaskInsert: '/api/recettes/recipe_task/',
  serviceRecipeTaskDelete: '/api/recettes/recipe_task/del/',

  serviceTestCampaign: '/api/recettes/test_campaign/',
  serviceTestCampaignUpdate: '/api/recettes/test_campaign/update/',
  serviceTestCampaignInsert: '/api/recettes/test_campaign/',
  serviceTestCampaignDelete: '/api/recettes/test_campaign/del/',

  serviceTestSession: '/api/recettes/test_session/',
  serviceTestSessionUpdate: '/api/recettes/test_session/update/',
  serviceTestSessionInsert: '/api/recettes/test_session/',
  serviceTestSessionDelete: '/api/recettes/test_session/del/',

  serviceTestResponse: '/api/recettes/test_response/',
  serviceTestResponseUpdate: '/api/recettes/test_response/update/',
  serviceTestResponseUpdate2: '/api/recettes/test_response/update2/',
  serviceTestResponseInsert: '/api/recettes/test_response/',
  serviceTestResponseDelete: '/api/recettes/test_response/del/',

  serviceTestTaskResponse: '/api/recettes/test_task_response/',
  serviceTestTaskResponseUpdate: '/api/recettes/test_task_response/update/',
  serviceTestTaskResponseUpdate2: '/api/recettes/test_task_response/update2/',
  serviceTestTaskResponseInsert: '/api/recettes/test_task_response/',
  serviceTestTaskResponseDelete: '/api/recettes/test_task_response/del/',

  // Utilisateurs du portail (testeurs), projetés par le module recettes
  serviceRecipeUsers: '/api/recettes/users/',

  // Upload des captures annotées → data/recettes/captures/
  serviceCaptureUpload: '/api/recettes/capture/upload/',
};
