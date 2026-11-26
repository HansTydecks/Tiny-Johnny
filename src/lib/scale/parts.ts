/**
 * Alle Bauteile der Platine mit kurzer Erklärung. `zoomTo`: Wer auf dieses Bauteil scrollt, landet in dieser Ebene –
 * egal, wo auf dem Bauteil der Mauszeiger steht.
 */
import { t, type I18n } from './zoom';

export interface Part {
  name: I18n;
  info: I18n;
  zoomTo?: string;
}

export const PARTS: Record<string, Part> = {
  cpu: {
    name: t('Prozessor (CPU)', 'Processor (CPU)'),
    info: t('Das Rechenwerk des Computers: führt Milliarden Befehle pro Sekunde aus. Unter dem Metalldeckel sitzt der Chip.', 'The computer’s brain: executes billions of instructions per second. The chip sits under the metal lid.'),
    zoomTo: 'cpu.die',
  },
  ram: {
    name: t('Arbeitsspeicher (RAM)', 'Memory (RAM)'),
    info: t('Hält Programme und Daten, mit denen gerade gearbeitet wird. Ohne Strom ist alles weg.', 'Holds the programs and data currently in use. Everything is lost when the power goes off.'),
    zoomTo: 'ram.die',
  },
  ssd: {
    name: t('SSD (M.2)', 'SSD (M.2)'),
    info: t('Dauerspeicher ohne bewegliche Teile: speichert Daten als eingesperrte Elektronen – auch ohne Strom.', 'Permanent storage without moving parts: stores data as trapped electrons – even without power.'),
    zoomTo: 'ssd.pkg',
  },
  gpu: {
    name: t('Grafikkarte (GPU)', 'Graphics card (GPU)'),
    info: t('Berechnet Bilder: tausende kleine Rechenkerne arbeiten gleichzeitig. Die Lüfter kühlen bis zu 450 Watt weg.', 'Computes images: thousands of small cores work at the same time. The fans remove up to 450 watts of heat.'),
    zoomTo: 'gpu.die',
  },
  hdd: {
    name: t('Festplatte (HDD)', 'Hard disk (HDD)'),
    info: t('Speichert Daten magnetisch auf einer schnell drehenden Scheibe. Ein Kopf schwebt knapp darüber.', 'Stores data magnetically on a fast-spinning platter. A head hovers just above it.'),
    zoomTo: 'hdd.surface',
  },
  pch: {
    name: t('Chipsatz', 'Chipset'),
    info: t('Der Verteiler: verbindet den Prozessor mit USB, SATA-Laufwerken, Netzwerk, Audio und weiteren Steckplätzen.', 'The hub: connects the processor to USB, SATA drives, network, audio and further slots.'),
    zoomTo: 'pch.die',
  },
  vrm: {
    name: t('Spannungswandler', 'Voltage regulators'),
    info: t('Machen aus den 12 V des Netzteils die etwa 1 V für den Prozessor – mit bis zu 300 A. Die Würfel sind Spulen.', 'Turn the power supply’s 12 V into about 1 V for the processor – at up to 300 A. The cubes are inductors.'),
  },
  heatsink: {
    name: t('Kühlkörper', 'Heatsink'),
    info: t('Aluminiumrippen geben die Wärme der Spannungswandler an die Luft ab.', 'Aluminium fins release the heat of the voltage regulators into the air.'),
  },
  caps: {
    name: t('Polymer-Kondensatoren', 'Polymer capacitors'),
    info: t('Kleine Energiespeicher: glätten die Spannung, wenn der Prozessor plötzlich mehr Strom braucht.', 'Small energy stores: smooth the voltage when the processor suddenly needs more current.'),
  },
  battery: {
    name: t('CMOS-Batterie', 'CMOS battery'),
    info: t('Eine Knopfzelle (CR2032) hält Uhrzeit und BIOS-Einstellungen, wenn der PC ausgeschaltet ist.', 'A coin cell (CR2032) keeps the clock and BIOS settings while the PC is switched off.'),
  },
  bios: {
    name: t('BIOS-Chip', 'BIOS chip'),
    info: t('Kleiner Flash-Speicher mit dem ersten Programm, das beim Einschalten läuft (UEFI/BIOS).', 'Small flash memory holding the first program that runs at power-on (UEFI/BIOS).'),
  },
  atx: {
    name: t('ATX-Stromanschluss (24 Pin)', 'ATX power connector (24 pin)'),
    info: t('Hier kommt der Strom vom Netzteil an: 3,3 V, 5 V und 12 V.', 'Power from the power supply arrives here: 3.3 V, 5 V and 12 V.'),
  },
  eps: {
    name: t('CPU-Stromanschluss (8 Pin)', 'CPU power connector (8 pin)'),
    info: t('Eigene 12-V-Leitung nur für den Prozessor.', 'A dedicated 12 V line just for the processor.'),
  },
  sata: {
    name: t('SATA-Anschlüsse', 'SATA ports'),
    info: t('Für Festplatten und ältere SSDs, bis zu 6 Gbit/s – das Kabel geht zur Festplatte daneben.', 'For hard disks and older SSDs, up to 6 Gbit/s – the cable leads to the hard disk next to the board.'),
  },
  usbhdr: {
    name: t('USB-3-Anschluss (intern)', 'USB 3 header (internal)'),
    info: t('Verbindet die USB-Buchsen vorne am Gehäuse mit der Platine.', 'Connects the USB ports on the front of the case to the board.'),
  },
  fanhdr: {
    name: t('Lüfteranschluss', 'Fan header'),
    info: t('4 Pins: Strom, Masse, Drehzahlmessung und Steuerung (PWM).', '4 pins: power, ground, speed sensing and control (PWM).'),
  },
  fpanel: {
    name: t('Frontpanel-Anschluss', 'Front panel header'),
    info: t('Für Einschaltknopf, Reset-Taste und die LEDs am Gehäuse.', 'For the power button, reset button and the case LEDs.'),
  },
  pcie: {
    name: t('PCIe-Steckplatz', 'PCIe slot'),
    info: t('Steckplatz für Erweiterungskarten. Der lange x16-Platz schafft rund 64 GB/s.', 'Slot for expansion cards. The long x16 slot moves about 64 GB/s.'),
  },
  dimmslot: {
    name: t('RAM-Steckplatz', 'Memory slot'),
    info: t('288 Kontakte für einen DDR5-Riegel. Zwei Plätze sind hier leer.', '288 contacts for a DDR5 module. Two slots are empty here.'),
  },
  socket: {
    name: t('CPU-Sockel', 'CPU socket'),
    info: t('Über 1800 federnde Kontakte verbinden den Prozessor mit der Platine. Der Hebel drückt ihn fest.', 'More than 1800 spring contacts connect the processor to the board. The lever clamps it down.'),
    zoomTo: 'cpu.die',
  },
  io: {
    name: t('Anschlüsse hinten', 'Rear I/O'),
    info: t('USB, Netzwerk (RJ45), HDMI und Audio – die Buchsen an der Rückseite des PCs.', 'USB, network (RJ45), HDMI and audio – the ports at the back of the PC.'),
  },
  audio: {
    name: t('Audio-Bereich', 'Audio section'),
    info: t('Eigener, abgetrennter Bereich mit Audio-Chip und Kondensatoren, damit kein Rauschen der Digitaltechnik ins Signal gelangt.', 'A separated area with audio chip and capacitors, so that digital noise does not get into the signal.'),
  },
  pcb: {
    name: t('Leiterplatte', 'Circuit board'),
    info: t('6–12 Lagen aus Kupfer und Glasfaser. Scrolle hier, um die Leiterbahnen aus der Nähe zu sehen.', '6–12 layers of copper and glass fibre. Scroll here to see the traces up close.'),
  },
  ant: {
    name: t('Ameise', 'Ant'),
    info: t('Eine 3 mm kleine Arbeiterin – zum Größenvergleich.', 'A 3 mm small worker ant – for comparison of size.'),
  },
};
