/** Texte der Bedienoberfläche (Deutsch/Englisch). */
import { t, type I18n } from './zoom';

export const UI = {
  loading: t('Mainboard wird gebaut …', 'Building the motherboard …'),
  noWebgl: t('Dein Browser unterstützt kein WebGL 2 – ohne das lässt sich die 3D-Ansicht leider nicht anzeigen.', 'Your browser does not support WebGL 2 – the 3D view cannot be shown without it.'),
  failed: t('Die 3D-Ansicht konnte nicht gestartet werden.', 'The 3D view could not be started.'),
  canvasLabel: t('3D-Ansicht eines Mainboards. Mit dem Mausrad oder Plus/Minus zoomen, mit den Pfeiltasten drehen, Escape zoomt eine Stufe heraus.', '3D view of a motherboard. Zoom with the mouse wheel or plus/minus, rotate with the arrow keys, Escape zooms out one level.'),
  pathLabel: t('Zoomstufen', 'Zoom levels'),
  langLabel: t('Sprache', 'Language'),
  reset: t('Übersicht', 'Overview'),
  fov: t('Sichtfeld', 'Field of view'),
  mag: t('Vergrößerung', 'Magnification'),
  dive: t('Tauchgang bis zum Atom', 'Dive down to the atom'),
  hintScroll: t('Scrollen: zoomen', 'Scroll: zoom'),
  hintDrag: t('Ziehen: drehen', 'Drag: rotate'),
  hintPan: t('Shift/Rechtsklick: verschieben', 'Shift/right-drag: pan'),
  hoverZoom: t('↓ Scrollen zum Hineinzoomen', '↓ Scroll to zoom in'),
} satisfies Record<string, I18n>;

export const PATH_BUTTONS: { leaf: string; label: I18n; color: string; title: I18n }[] = [
  { leaf: 'cpu.atoms', label: t('CPU'), color: '#8b87ff', title: t('Vom Prozessor bis zu den Silizium-Atomen', 'From the processor down to silicon atoms') },
  { leaf: 'ram.atoms', label: t('RAM'), color: '#6ea8ff', title: t('Vom Arbeitsspeicher bis in einen Kondensator', 'From the RAM stick into a capacitor') },
  { leaf: 'ssd.atoms', label: t('SSD'), color: '#34d399', title: t('Von der SSD bis zu gefangenen Elektronen', 'From the SSD down to trapped electrons') },
  { leaf: 'hdd.atoms', label: t('HDD'), color: '#f5a524', title: t('Von der Festplatte bis zu magnetischen Atomen', 'From the hard disk down to magnetic atoms') },
  { leaf: 'pch.atoms', label: t('Chipsatz', 'Chipset'), color: '#f07167', title: t('Vom Chipsatz bis zu den Atomen', 'From the chipset down to the atoms') },
  { leaf: 'gpu.atoms', label: t('GPU'), color: '#ff7ab6', title: t('Von der Grafikkarte bis zur Speicherzelle', 'From the graphics card down to a memory cell') },
];
