export const RecursionScripts = {
  FactorialRecursion: `SCENE FactorialRecursion

DECLARE
  FUNCTION factorial(n) {
    IF n <= 1 {
      RETURN 1
    }
    RETURN n * factorial(n - 1)
  }

SEQUENCE
  // factorial(5) = 5 * 4 * 3 * 2 * 1 = 120
  result = factorial(5)
END
`,

  FibonacciRecursion: `SCENE FibonacciRecursion

DECLARE
  FUNCTION fib(n) {
    IF n <= 1 {
      RETURN n
    }
    RETURN fib(n - 1) + fib(n - 2)
  }

SEQUENCE
  // fib(7) walks the classic exponential recursion tree
  result = fib(7)
END
`,

  RecursiveArraySum: `SCENE RecursiveArraySum

DECLARE
  ARRAY arr = [4, 8, 15, 16, 23]
  FUNCTION sumFrom(i) {
    IF i >= LENGTH(arr) {
      RETURN 0
    }
    RETURN arr[i] + sumFrom(i + 1)
  }

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
  END
  total = sumFrom(0)
END
`,

  PowerByRecursion: `SCENE PowerByRecursion

DECLARE
  FUNCTION power(base, exp) {
    IF exp == 0 {
      RETURN 1
    }
    RETURN base * power(base, exp - 1)
  }

SEQUENCE
  // 2^10 computed by repeated recursive multiplication
  result = power(2, 10)
END
`,

  GCDByRecursion: `SCENE GCDByRecursion

DECLARE
  FUNCTION gcd(a, b) {
    IF a == b {
      RETURN a
    }
    IF a > b {
      RETURN gcd(a - b, b)
    }
    RETURN gcd(a, b - a)
  }

SEQUENCE
  // Subtraction-based Euclidean algorithm: gcd(48, 18) = 6
  result = gcd(48, 18)
END
`,

  PalindromeCheckRecursion: `SCENE PalindromeCheckRecursion

DECLARE
  ARRAY chars = [1, 2, 3, 2, 1]
  FUNCTION isPalindrome(lo, hi) {
    IF lo >= hi {
      RETURN 1
    }
    IF chars[lo] != chars[hi] {
      RETURN 0
    }
    RETURN isPalindrome(lo + 1, hi - 1)
  }

SEQUENCE
  LOOP i FROM 0 TO LENGTH(chars) - 1
    HIGHLIGHT chars[i]
  END
  result = isPalindrome(0, LENGTH(chars) - 1)
END
`,

  RecursiveLinearSearch: `SCENE RecursiveLinearSearch

DECLARE
  ARRAY arr = [4, 2, 9, 7, 5]
  FUNCTION findIndex(i, target) {
    IF i >= LENGTH(arr) {
      RETURN -1
    }
    IF arr[i] == target {
      RETURN i
    }
    RETURN findIndex(i + 1, target)
  }

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
  END
  // Recurses one index at a time until it finds 7
  result = findIndex(0, 7)
END
`
};
