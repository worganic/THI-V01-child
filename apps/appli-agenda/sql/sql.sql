
-- =============================================================================
-- Schéma de Base de Données MySQL - Application Agenda & Gestion de Projets
-- Écosystème Airbus Helicopters Monorepo SI
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `pr_agenda` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pr_agenda`;

-- 1. Table des Utilisateurs / Développeurs
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `matricule` VARCHAR(15) NOT NULL UNIQUE,
  `firstname` VARCHAR(50) NOT NULL,
  `lastname` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `role` VARCHAR(30) DEFAULT 'DEV', -- DEV, IT_GESTIONNAIRE, MEDIA, ADMIN
  `avatar` VARCHAR(255) NULL,
  `date_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `date_update` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table des Projets
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('A_FAIRE', 'EN_COURS', 'TERMINER') DEFAULT 'A_FAIRE',
  `risk_level` ENUM('FAIBLE', 'MOYEN', 'ELEVE') DEFAULT 'FAIBLE',
  `date_start` DATE NOT NULL,
  `date_end_estimated` DATE NOT NULL,
  `estimated_time_days` DECIMAL(5,1) NOT NULL DEFAULT 0.0, -- Durée estimée en jours / demi-journées
  `created_by_matricule` VARCHAR(15) NOT NULL,
  `date_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `date_update` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table de Liaison Projets <-> Développeurs (Affectations)
CREATE TABLE IF NOT EXISTS `project_developers` (
  `project_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  PRIMARY KEY (`project_id`, `user_id`),
  CONSTRAINT `fk_proj_dev_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proj_dev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table des Tâches / Actions de Projets
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `parent_task_id` INT NULL, -- Pour les sous-tâches
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('NON_COMMENCE', 'EN_ATTENTE', 'EN_COURS', 'TERMINER') DEFAULT 'NON_COMMENCE',
  `assigned_user_id` INT NULL,
  `date_start` DATE NOT NULL,
  `date_end` DATE NOT NULL,
  `half_days_duration` DECIMAL(4,1) NOT NULL DEFAULT 1.0, -- Durée en demi-journées (ex: 1.0 = 0.5 jour, 2.0 = 1 jour)
  `comments` TEXT NULL,
  `is_risky` TINYINT(1) DEFAULT 0,
  `date_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `date_update` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_task_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_parent` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_task_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Données de test / Initialisation
-- =============================================================================
INSERT INTO `users` (`matricule`, `firstname`, `lastname`, `email`, `role`) VALUES
('X412345', 'Johann', 'LOREAU', 'johann.loreau@airbus.com', 'IT_GESTIONNAIRE'),
('X600001', 'Damien', 'HOSTIN', 'damien.hostin@airbus.com', 'ADMIN'),
('X600002', 'Farida', 'CARTIER', 'farida.cartier@airbus.com', 'MEDIA'),
('X700010', 'Thomas', 'LECLERC', 'thomas.leclerc@airbus.com', 'DEV'),
('X700011', 'Sophie', 'MARTIN', 'sophie.martin@airbus.com', 'DEV'),
('X700012', 'Alexandre', 'DUBOIS', 'alexandre.dubois@airbus.com', 'DEV');

INSERT INTO `projects` (`code`, `name`, `description`, `status`, `risk_level`, `date_start`, `date_end_estimated`, `estimated_time_days`, `created_by_matricule`) VALUES
('PRJ-SI-001', 'Refonte Interface Nursery SI', 'Migration vers Angular Standalone et intégration SOLACE dans le Monorepo NX', 'EN_COURS', 'MOYEN', '2026-07-20', '2026-08-14', 15.0, 'X412345'),
('PRJ-SOL-002', 'Supervision Streaming MQTT', 'Tableau de bord temps réel pour les flux Solace du centre de formation', 'A_FAIRE', 'FAIBLE', '2026-08-03', '2026-08-28', 10.0, 'X600001'),
('PRJ-DOC-003', 'Automatisations Leaflets DocLib', 'Génération automatique des fiches d un cours et association avec tablettes Surface', 'TERMINER', 'FAIBLE', '2026-07-01', '2026-07-17', 12.0, 'X600002');

INSERT INTO `project_developers` (`project_id`, `user_id`) VALUES
(1, 4), (1, 5),
(2, 5), (2, 6),
(3, 4);

INSERT INTO `tasks` (`project_id`, `name`, `status`, `assigned_user_id`, `date_start`, `date_end`, `half_days_duration`, `comments`, `is_risky`) VALUES
(1, 'Découpage Composants Standalone Header/Footer', 'TERMINER', 4, '2026-07-20', '2026-07-21', 4.0, 'Validé avec la charte Airbus', 0),
(1, 'Service HTTP Proxy & Mock APIs Relative', 'EN_COURS', 4, '2026-07-22', '2026-07-24', 6.0, 'En attente validation CORS backend', 1),
(1, 'Composant Planning Gantt & Agenda par Dev', 'EN_COURS', 5, '2026-07-23', '2026-07-28', 8.0, 'Intégration du découpage en demi-journées', 0),
(2, 'Broker MQTT Client RXJS Integration', 'NON_COMMENCE', 6, '2026-08-03', '2026-08-07', 10.0, 'Prévoir clés certificat SSL', 0);