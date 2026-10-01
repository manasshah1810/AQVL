export const LayoutScripts = {
  ArrayLineSpacing: `SCENE ArrayLineSpacing

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  HIGHLIGHT arr[2]
  WAIT
END
`,

  HorizontalStack: `SCENE HorizontalStack

DECLARE
  STACK s

SEQUENCE
  LAYOUT s AS LINE(spacing=1.2, axis=horizontal, origin=(0, 1, 0))
  PUSH s 10
  PUSH s 20
  PUSH s 30
  WAIT
END
`,

  RingOfValues: `SCENE RingOfValues

DECLARE
  ARRAY ring = [1, 2, 3, 4, 5, 6, 7, 8]

SEQUENCE
  LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)
  LOOP i FROM 0 TO LENGTH(ring) - 1
    HIGHLIGHT ring[i]
  END
  WAIT
END
`,

  ArrayAsMatrix: `SCENE ArrayAsMatrix

DECLARE
  ARRAY cells = [1, 2, 3, 4, 5, 6, 7, 8, 9]

SEQUENCE
  LAYOUT cells AS GRID(columns=3, spacingX=1.5, spacingY=1.5)
  HIGHLIGHT cells[0]
  HIGHLIGHT cells[4]
  HIGHLIGHT cells[8]
  WAIT
END
`,

  GraphPhysicsToRing: `SCENE GraphPhysicsToRing

DECLARE
  GRAPH g = ["A->B", "B->C", "C->A"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(iterations=60)
  WAIT

  LAYOUT g AS CIRCULAR(radius=3)
  WAIT
END
`,

  TreeSpacing: `SCENE TreeSpacing

DECLARE
  BST myTree = [50, 30, 70, 20, 40, 60, 80]

SEQUENCE
  LAYOUT myTree AS HIERARCHY(levelGap=2, siblingGap=1)
  WAIT
END
`,

  CameraFocusTwoStructures: `SCENE CameraFocusTwoStructures

DECLARE
  ARRAY nums = [4, 2, 7]
  BST myTree

SEQUENCE
  CAMERA FOCUS(myTree)
  INSERT 40
  INSERT 20
  INSERT 60
  WAIT

  CAMERA FOCUS(nums)
  COMPARE nums[0] nums[1]
  WAIT

  CAMERA AUTO_FIT
END
`,

  CameraOrbit: `SCENE CameraOrbit

DECLARE
  BST myTree = [50, 30, 70]

SEQUENCE
  CAMERA ORBIT(15)
  INSERT 20
  WAIT
  INSERT 60
  WAIT

  CAMERA AUTO_FIT
END
`,

  CameraFixedAngle: `SCENE CameraFixedAngle

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  HIGHLIGHT arr[2]
  WAIT
END
`,

  PinAndRelease: `SCENE PinAndRelease

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)

  POSITION arr[2] AT (x=5, y=2, z=0)
  HIGHLIGHT arr[2]
  WAIT

  POSITION arr[2] AT ()
  WAIT
END
`,

  ManualPlacement: `SCENE ManualPlacement

DECLARE
  ARRAY pts = [1, 2, 3]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=-3, y=0, z=0)
  POSITION pts[1] AT (x=0, y=2, z=0)
  POSITION pts[2] AT (x=3, y=0, z=0)
  WAIT
END
`,
};
