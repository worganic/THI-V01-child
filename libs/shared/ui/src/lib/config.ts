export const environment = {
    production: true,
    version: '0.1.0',
    versionDate: '2026-03-24',
    debug: false,
  
    envAdresse: "http://sma8607:8080/dev/ip.php",
    envLinkMyAhts: "http://localhost:8080/jl/files",
    envDefault: 'prod',
    timerRooms: 20,
  
    serviceDomaine:  "http://sma8523:8020/val/v2",
    //serviceDomaine:  "http://localhost:8090/jl/v2",
  
    serviceProd:  "http://sma8523:8020/val/v2",
    serviceVal:  "/val/v2",
    serviceDev:  "http://sma8607:8080/v2",
  
    serviceConnexion: "/ETS/user/connexionSupervision",

    serviceServices: "/outils/generateur/listeServices",
    serviceLogs: "/outils/logs",
    serviceDocs: "/DIPLOME/docs",
  
    serviceTraineeInfos: "/STAGIAIRES/profils/infos",
    serviceTraineeControl: "/STAGIAIRES/profils/control",
    serviceTraineeEdit: "/STAGIAIRES/profils/update",
    serviceTraineeSearch: "/STAGIAIRES/profils/search",
  
    serviceRoom: "/PLANNING/classroom/coursActive",
  
    serviceStatsDivers: "/OUTILS/stats/statsDivers",
  
    serviceBlocsList: "/PLANNING/bloc/liste",
    serviceBlocsSearch: "/PLANNING/bloc/search",
    serviceBlocDateVerif: "/SATIS/classe/classeDateVerif",
    
    serviceReleases: "/outils/patchnotes/liste",
  
    serviceInstructeurs: "/INSTRUCTEURS/profils/search",
    serviceCoursRecupBy: "/SI/cours/recupBy/?options=hydrat",
    serviceCoursRecupByDate: "/SI/cours/recupByDate/?options=hydrat",
    serviceCours: "/SI/cours/?options=hydrat&pageNumParPage=300",
    serviceCoursB: "/SI/cours/",
    serviceLocalisation: "/SI/localisation/?options=hydrat&pageNumParPage=100",
    serviceRessource: "/SI/ressources/?options=hydrat&pageNumParPage=300",
    serviceCourstype: "/SI/courstype/?options=hydrat&pageNumParPage=300",
    serviceTrainee: "/SI/trainee/?options=hydrat&pageNumParPage=300",
    serviceAircraft: "/SI/aircrafts/?options=hydrat&pageNumParPage=300",
    serviceTablettes: "/SI/tablettes/?options=hydrat&pageNumParPage=300",
    serviceTabletteRecupBy: "/SI/tablettes/recupBy/?options=hydrat&pageNumParPage=300",
    servicetablettesCours: "/SI/coursTablettes/?options=hydrat&pageNumParPage=300",
    servicetablettesCoursInsert: "/SI/coursTablettes/insert/",
    servicetablettesCoursDelete: "/SI/coursTablettes/del/",
    servicetablettesType: "/SI/tablettesType/?options=hydrat",
    serviceInstructeursMdp: "/INSTRUCTEURS/profils/mdp",
  
    serviceQrCode: "/QRCODE/qrCodes/",
  
  
    serviceUsersListe: "/ETS/user/liste",
    serviceUsersInfosComplete: "/ETS/user/infoComplete",
    urlConnexionProvMyahts: "/ETS/resetPassword/tokenProvisoirMyAhts",
    urlConnexionProvTMS2: "/ETS/resetPassword/tokenProvisoirTms2",
  
    serviceAlertes: "/STAGIAIRES/profils/alertes",
    serviceAlertesExams: "/PLANNING/bloc/listBloc/",
  
    AuthenticationScheme: "",
    
    checkServerProd: "http://myahts.eu.eurocopter.corp/checkServer.php",
    checkServerVal: "http://sma8523:8020/val/checkServer.php",
    checkServerDev: "http://sma8607:8080/dev/checkServer.php",
  
    IDUSER: '9999',//Utilisateur spécifique supervisation.
    IDTRANSACTION: 'AA1111111',//
    IDAPPEL: '9999'//
  };
  